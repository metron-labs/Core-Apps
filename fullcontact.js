var Client = require('node-rest-client').Client;
var client = new Client();
var emitter = require("../core-integration-server-v2/javascripts/emitter");

var apiKey;
var errMsg = 'Error in connecting FullContact';

function enrichData(data, node) {
	try { 
		var reqObj = node.reqData;
		var customObj = {};
		var tFollowers ="", gFollowers = "", gfollowing = "", tCount = 0, 
		gFollowersCount = 0, gfollowingCount = 0,dataObj;
		var name ="", role = "", seniority = "", title = 0 ;
		if(data.hasOwnProperty("socialProfiles")) {
			dataObj = data.socialProfiles;
			for(var i=0; i<dataObj.length; i++) {
				var checkobj = dataObj[i];
				if(checkobj.typeName == "Twitter") {
					tFollowers = checkobj.followers;
					if(tFollowers !=null || tFollowers !="" ){
						tCount = tFollowers;
					}
				}else if(checkobj.typeName == "github") {
					gFollowers = checkobj.followers;
					gfollowing = checkobj.following
				}
			}
		}else{
			 dataObj = data.organizations;
			for(var i=0; i<dataObj.length; i++) {
				var checkobj = dataObj[i];
				if(checkobj.title == "Twitter") {
					name =checkobj.name;
					role = checkobj.role;
					seniority = checkobj.seniority;
					title = checkobj.title;
				}
			}
		}
		if(reqObj.hasOwnProperty('shippingAddress')) {
			reqObj.type = 'order';
			reqObj.TwitterFollowers = tCount;
		} else {
			reqObj.type = 'customer';
			reqObj.TwitterFollowers = tCount;
			reqObj.Title = title;
		}
		var message = 'Person with email id ' + reqObj.email + ' had found in Clearbit';
		node.dataObj = reqObj;
		emitter.emit("save-to-core", node, message);
	} catch(e) {
		emitter.emit('error', e.message, e.stack,'',node);
	}
}

function post(resArr, node, message) {
	node.resData = resArr;
	emitter.emit("success", node, message);
}


function findFullContact(node) {
	try {
		var reqObj = node.reqData;
		var url = "https://api.fullcontact.com/v2/person.json?email=" + reqObj.email;
			var args = {
				headers : {
				"X-FullContact-APIKey" : apiKey,
				Accept : "application/json"
				}
			};
			client.get(url, args, function(data, res){
				try {
					var status = parseInt(res.statusCode/100);
					if(status == 2){
						enrichData(data, node);						
					} else{
						if(data.hasOwnProperty('message')) {
							errMsg = data.message;
						}
						emitter.emit('error', errMsg, args.data, url, node);
					}
				} catch(e) {
					emitter.emit('error', e.message, e.stack, url, node);
				}
			}).on('error', function(err) {
				emitter.emit('error', errMsg, args.data, url, node);
			});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function getCoreCacheData(node) {
	try {
		actionName = node.connection.actionName.toLowerCase();
		emitter.emit("get-from-core", node, function(data) {
			try {
				var resArr = [];
				var resObj;
				for(var i = 0; i < data.length; i++) {
					resObj = data[i].dataObj;
					if(resObj.hasOwnProperty('shippingAddress')) {
						resObj.type = 'order';
					} else {
						resObj.type = 'customer';
					}
					if(i == data.length-1) {
						resObj.isLast = true;
						if(actionName == 'slack') {
							resObj.slackFlag = true;
						}
					}
					resArr[i] = resObj;
				}
				post(resArr, node, '');
			} catch(e) {
				emitter.emit('error', e.message, e.stack, "", node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}
function testApp(callback) {
	try {
		var url = "https://api.fullcontact.com/v2/person.json?email=bart@fullcontact.com";
		var args = {
			headers : {
				"X-FullContact-APIKey" : apiKey,
				Accept : "application/json"
			}
		};
		client.get(url, args, function(data, res) {
			try {
				var statusCode = parseInt(res.statusCode/100);
				if(statusCode == 2) {
					result = {
						status :'success',
						response: data
					};
				} else{
					result = {
						status :'error',
						response : data
					};  
				}
				callback(result);
			} catch(e) {
				callback({status:"error", response:e.stack});
			}
		}).on('error', function(err) {
			callback({status:"error", response:err});
		});
	} catch(e) {
		callback({status:"error", response:e.stack});
	}
}


function run(node) {
	try {
		var nodeType =  node.connector.type.toLowerCase();
		if(nodeType == 'trigger') {
			getCoreCacheData(node);
		} else{
			findFullContact(node);
		}
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}


function test(request, callback) {
	try {
		var credentials = request.credentials;
		apiKey = credentials.apiKey;
		testApp(callback);
	} catch(e) {
		callback({status:"error", response:e.stack});
	}
}

function init(node) {
	try {
		var credentials = node.credentials;
		apiKey = credentials.apiKey;
		run(node);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

var FullContact = {
	init : init,
	test : test
};

module.exports = FullContact;