var Client = require('node-rest-client').Client;
var client = new Client();

var emitter = requireg('../core-integration-server-v2/javascripts/emitter');

var apiKey;
var errMsg = 'Error in connecting FullContact';

function run(node) {
	try {
		var reqObj = node.reqData;
		var url = "https://api.fullcontact.com/v2/person.json?email=" + reqObj.email;
		var args = {
			headers : {
			"X-FullContact-APIKey" : apiKey,
			Accept : "application/json"
			}
		};
		client.get(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				var msg;
				if(status == 2) {
					msg = "Email with" + reqObj.email + " is successfully enriched in FullContact.";
					post(data, node, msg);						
				} else {
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

function b64EncodeUnicode(str) {
	return new Buffer(str).toString('base64');
}

function post(resArr, node, message) {
	node.resData = resArr;
	emitter.emit("success", node, message);
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