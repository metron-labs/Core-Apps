var Client = require('node-rest-client').Client;
var client = new Client();

var emitter = require('../javascripts/emitter');
var tokenSecret, storeId, message, username;
var errMsg = 'Something went wrong on the request';

function run(node) {
	try {
		var nodeType = node.connector.type.toLowerCase();
		var type = node.option.toLowerCase();
		var reqObj = node.requestData;
		if(nodeType == 'trigger') {
			getStoreData(type, node);
		} else {
			postStoreData(type, node);
		}
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function getStoreData(type, node) {
	try {
		var url = "https://slack.com/api/users.list?token=" + tokenSecret;
		client.get(url, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					setCoreCustomers(data.members, node);
				}
			}  catch(e) {
        		emitter.emit('error', e.message, e.stack, url, node);
        	}
		})
	} catch(e) {
        emitter.emit('error', e.message, e.stack, "", node);
    }
}

function setCoreCustomers(userArr, node) {
	try {
		var reqArr = [];
		var obj, reqObj;
		for (var i = 0; i < userArr.length; i++) {
			reqObj = {};
			obj = userArr[i];
			reqObj.id = obj.id;
			reqObj.name = obj.name;
			reqObj.profile = obj.profile;
			reqObj.lastName = obj.profile.last_name;
			reqObj.email = obj.profile.email;
			reqArr[i] = reqObj;
		}
		post(reqArr, node, '');
	} catch(e) {
        emitter.emit('error', e.message, e.stack, "", node);
    }
}

function post(response, node, message) {
	node.resData = response;
	emitter.emit('success', node, message);
}

function postStoreData(type, node) {
	try {	
		var reqObj = node.reqData;	
		var method = node.option.toLowerCase();		
		if(reqObj.email == '' || null) {
			var msg = method + " does not have email";
			emitter.emit('error', msg, '', '', node);
		}
		if(method == "invite") {
			postInvite(node, type);
		} else {			
			postMessage(type, node);		
		}		
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}
 
function postInvite(node, type) {
	try {
		var reqObj = node.reqData;
		var url = "https://slack.com/api/users.admin.invite?token=" + tokenSecret + "&channels=" + storeId + "&set_active=true&email=" + reqObj.email + "&scope=identify,read,post,client";
		client.post(url, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				var msg;
				if(status == 2) {
					msg = "Invite email has been sent successfully to " + reqObj.email + " from Slack"; 
					post(data, node, msg);
				} else {
					emitter.emit('error', errMsg, data, url, node);

				}
			} catch(e) {
				emitter.emit('error', e.message, e.stack, url, node)
			}
		}).on('error', function(err){
			emitter.emit('error', errMsg, data, url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function postMessage(type, node) {
	try {
		var reqObj = node.reqData;
		var msgFlag = reqObj.slackFlag;
		if(msgFlag) {
			var url = "https://slack.com/api/chat.postMessage?token=" + tokenSecret + "&channel=" + storeId + "&text=" + encodeURIComponent(message) + "&username=" + username;
			client.post(url, function(data, res) { 
				try {
					var status = parseInt(res.statusCode/100);
					var msg;
					if(status == 2) {
						msg = "Message has been sent successfully to the Channel with id " + storeId + " in Slack";
						post(data, node, msg);
					} else {
						emitter.emit('error', errMsg, data, url, node);
					}
				} catch(e) {
					emitter.emit('error', e.message, e.stack, url, node)
				}
			}).on('error', function(err) {
				emitter.emit('error', errMsg, data, url, node);
			});
		} else {
			post(reqObj, node, '');
		}		
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function testApp(callback) {
	try {
		var url = "https://slack.com/api/channels.list?token=" + tokenSecret;
		client.get(url, function(data, res) {
			try {
				var statusCode = parseInt(res.statusCode/100);
				if(statusCode == 2) {
					result = {
						status : 'success',
						response : data
					};
				} else {
					result = {
						status : 'error',
						response : data
					};
				}
				callback(result);
			} catch(e) {
				callback({status : 'error', response : e.stack});
			}
		}).on('error', function(err) {
			callback({status:"error", response:err});
		});
	} catch(e) {
        callback({status:"error", response:e.stack});
    }
}

function test(request, callback) {
	try {
		var credentials = request.credentials;
		tokenSecret = credentials.tokenSecret;
		testApp(callback);
	} catch(e) {
		callback({status:'error', response:e.stack});
	}
}

function init(node) {
	try {
		var credentials = node.credentials;
		tokenSecret = credentials.tokenSecret;
		storeId = credentials.storeId;
		message = credentials.message;
		username = credentials.username;
		run(node);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node)
	}
}

var Slack = {
	init : init,
	test : test
}

module.exports = Slack;