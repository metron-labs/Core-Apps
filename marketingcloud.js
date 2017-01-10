var Client = require('node-rest-client').Client;
var async = require('async');
var client = new Client();

var emitter = require('../core-integration-server-v2/javascripts/emitter');

var clientId, clientSecret, customerKey, fromName, fromAddress, accessToken, fileUrl;
var errMsg = 'Error in connecting MarketingCloud';

function run(node) {
	try {
		var url = 'https://auth.exacttargetapis.com/v1/requestToken';
		var postData = {
			clientId : clientId,
			clientSecret : clientSecret
		};
		var args = {
			data : postData,
			headers : {Accept : 'application/json'}
		};
		var type = node.option.toLowerCase();
		client.post(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					accessToken = data.accessToken;
					if(type == 'file') {						
						sendFile(node);									 	 
					} else {
						sendMail(node);
					}
				} else {
					emitter.emit('error',data, args.data, url, node);
				}
			} catch(e) {
				emitter.emit('error', e.message, e.stack, url, node);
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, args.data, url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '',node);
	}
}

function sendFile(node) {
	try {
		var url = 'https://www.exacttargetapis.com/messaging/v1/messageDefinitionSends/key:' + customerKey + '/send';
		var reqObj = node.reqData;
		var postData = {
			From : {
				Address : fromAddress,
				Name : fromName
			},
			To : {
				Address : reqObj.email,
				SubscriberKey : reqObj.email,
				ContactAttributes :{
					SubscriberAttributes:{
						fileAddrs : fileUrl
					}
				}
			}
		};
		var args = {
			data : postData,
			headers : {
				Authorization : 'Bearer ' + accessToken,
				Accept : 'application/json',
				'Content-Type' : 'application/json'
			}
		};
		client.post(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					var msg = 'Mail has been sent successfully to ' + reqObj.email + ' through MarketingCloud';
					post(data, node, msg);
				} else {
					emitter.emit('error', data.message, args.data, url, node);
				}
			} catch(e) {
				emitter.emit('error', e.message, e.stack, url, node);
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, args.data, url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '',node);
	}
}

function sendMail(node) {
	try {
		var reqObj = node.reqData;
		var url = 'https://www.exacttargetapis.com/messaging/v1/messageDefinitionSends/key:' + customerKey + '/send';
		var postData = {
			From : {
				Address : fromAddress,
				Name : fromName
			},
			To : {
				Address : reqObj.email,
				SubscriberKey : reqObj.email,
				ContactAttributes :{
					SubscriberAttributes:{}
				}
			}
		};
		var args = {
			data : postData,
			headers : {
				Authorization : 'Bearer ' + accessToken,
				Accept : 'application/json',
				'Content-Type' : 'application/json'
			}
		};
		client.post(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					var msg = 'Mail has been sent successfully to ' + reqObj.email + ' through MarketingCloud';
					post(data, node,msg);
				} else {
					emitter.emit('error', data.message, args.data, url, node);
				}
			} catch(e) {
				emitter.emit('error', e.message, e.stack, url, node);
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, args.data, url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '',node);
	}
}

function post(response, node, message) {
	node.resData = response;
	emitter.emit('success', node, message);
}

function testApp(callback) {
	try {
		var url = 'https://auth.exacttargetapis.com/v1/requestToken';
		var postData = {
			clientId : clientId,
			clientSecret : clientSecret
		};
		var args = {
			data : postData,
			headers : {Accept : 'application/json'}
		};
		client.post(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				var result;
				if(status == 2) {
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
				emitter.emit('print', 'testing credentials');
				callback(result);
			} catch(e) {
				callback({status:'error', response:e.stack});
			}
		}).on('error', function(err) {
			callback({status:'error', response:err});
		});
	} catch(e) {
		callback({status:'error', response:e.stack});
	}
}

function test(request, callback) {
	try {
		var credentials = request.credentials;
		clientId = credentials.clientId;
		clientSecret = credentials.clientSecret;
		testApp(callback);
	} catch(e) {
		callback({status:'error',response:e.stack});
	}
}

function init(node) {
	try {
		var credentials = node.credentials;
		clientId = credentials.clientId;
		clientSecret = credentials.clientSecret;
		customerKey = credentials.customerKey;
		fromName = credentials.fromName;
		fromAddress = credentials.fromAddress;
		var type = node.option.toLowerCase();
		if(type == 'file') {
			fileUrl = credentials.fileUrl;			
		}
		run(node);
	} catch(e) {
		emitter.emit('error',e.message,e.stack,'',node);
	}
}

var MarketingCloud = {
	init : init,
	test : test
};

module.exports = MarketingCloud;
