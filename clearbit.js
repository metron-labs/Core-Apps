var Client = require('node-rest-client').Client;
var client = new Client();

var emitter = require('../core-integration-server-v2/javascripts/emitter');

var apiKey, actionName, triggerName;
var errMsg = '"Connection timeout error" in Clearbit';

function run(node) {
	try {
		var nodeType = node.connector.type.toLowerCase();
		if(nodeType == "trigger") {
			getCoreCacheData(node);
		} else {
			searchClearbit(node);
		}
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
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
				node.resData = resArr;
				emitter.emit("success", node, message);
			} catch(e) {
				emitter.emit('error', e.message, e.stack, "", node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function searchClearbit(node) {
	try {	
		var obj = node.reqData;
		triggerName = node.connection.triggerName.toLowerCase();
		if(obj.email != null && obj.email != '') {
			var url = "https://person.clearbit.com/v2/combined/find?email=" + obj.email;
			var args = {
				headers: { Authorization : "Bearer " + apiKey, Accept : "application/json" }
			};
			setTimeout(function() {
				client.get(url, args, function(data, res) {
					try {
						var status = parseInt(res.statusCode/100);
						if(status == 2) {
							enrichData(data, node);
						} else {
							if(status == 5) {
								emitter.emit('error', 'Server error in Clearbit', '', url, node);
								return;
							}
							if(data.hasOwnProperty("error")) {
								var error = data.error;
								errMsg = error.message;
							}
							if(errMsg.includes('Unknown person.')) {
								errMsg = ' The person with email id ' + obj.email + ' is a ' + errMsg + ' in Clearbit';
							}
							emitter.emit('error', errMsg, args.data, url, node);
						}
					} catch(e) {
						emitter.emit('error', e.message, e.stack, url, node);
					}
				} catch(e) {
					emitter.emit('error', e.message, e.stack, url, node);
				}
			}).on('error',function(err) {
				emitter.emit("error", errMsg,err, url, node);
			});	
		}, 5000);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function enrichData(data, node) {
	try { 
	    var reqObj = node.reqData;
	    var person = data.person;
	    var tfollowers = 0, gfollowers = 0, gfollowing = 0;
	    if(person.hasOwnProperty('twitter')) {
	    	tfollowers = person.twitter.followers;
	    }
	    if(person.hasOwnProperty('github')) {
	    	gfollowers = person.github.followers;
	    	gfollowing = person.github.following;
	    }
	    if(person.hasOwnProperty('employment')) {
	    	var employment = person.employment;
	    	if(employment.title != null) {
	    		reqObj.title = employment.title;
	    	}
	    	if(employment.name != null) {
	    		reqObj.company = employment.name;
	    	}
	    	if(employment.seniority != null) {
	    		reqObj.seniority = employment.seniority;
	    	}
	    	if(employment.role != null) {
	    		reqObj.designation = employment.role;
	    	}
	    }
	    reqObj.twitterFollowers = tfollowers;
	    reqObj.gitHubFollowers = gfollowers;
	    reqObj.gitHubFollowing = gfollowing;
	   	var msg = 'Person with email id ' + reqObj.email + ' had found in Clearbit';
		emitter.emit('save-to-core', node, msg);
	} catch(e) {
		emitter.emit('error', e.message, e.stack,'',node);
	}
}

function testApp(callback) {
	try {
		var url = "https://company-stream.clearbit.com/v2/companies/find?domain=neemtecsolutions.com";
		var args = {      
			headers : {
				"Authorization" : "Bearer " + apiKey,
				"Accept" : "application/json"
			}
		};
		var result;
		client.get(url, args, function (data, res) {
			try {
				var statusCode = parseInt(res.statusCode/100);
				if(statusCode == 2) {
					result = {
						status :'success',
						response: data
					};
				} else {
					if(data.hasOwnProperty("error")) {
						var error = data.error;
						var errMsg = error.message;
					}
					result = {
						status :'error',
						response : errMsg
					};
				}
				callback(result);
			} catch(e) {
				callback({status:"error", response:e.stack});
			}
		}).on('error',function(err) {
			console.log(errMsg, err.request.options);
		});
	} catch(e) {
		callback({status:"error", response:e.stack});
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
		emitter.emit('error', e.message, e.stack,'',node);
	}
}

var Clearbit = {
	init :  init,
	test : test
};

module.exports = Clearbit;