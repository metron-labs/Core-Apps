var Client = require('node-rest-client').Client;
var client = new Client();
var fs = require('fs');

 var emitter = require('../core-integration-server-v2/javascripts/emitter');

var apiKey, fromName, fromAddress, mailSubject, textMessage, sendAt, templateName;
var errMsg = '"Connection timeout error" in Mandrill';

function run(node) {
	try {
		var type = node.option.toLowerCase();
		var url = "https://mandrillapp.com/api/1.0/messages/";
		if(type == "template" || type  == "schedule template") {
			sendTemplate(url, type, node);
		} else if(type == 'file'|| type  == "schedule file")  {
			sendFile(url, type, node);
		} else {
			sendMail(url, type, node);
		}
	} catch(e) {
		emitter.emit('error',e.message, e.stack, "", node);
	}
}

function sendTemplate(url, type, node) {
	try {
		var obj = node.reqData;
		var msg = 'Mail has been sent successfully to ' + obj.email + ' through Mandrill';
		var newUrl = url + "send-template.json";
		var contentName = "customer-name";
		var contentValue = obj.name;
		if(templateName.toLowerCase() == "empty attribute") {
			contentName = "customer-email";
			contentValue = obj.email;
		} else if(templateName.toLowerCase() == "new customer") {
			contentName = "store-name";
			contentValue = obj.triggerName;
		} else if(templateName.toLowerCase() == "new order" && obj.hasOwnProperty("shippingAddress")) {
			contentName = "order-no";
			contentValue = obj.name;
		}
		var postData = {
			key : apiKey,
			message : {
				from_email : fromAddress,
				from_name : fromName,
				to : [{
					email : obj.email,
					name : fromName
				}]
			},	
			template_name : templateName,
			template_content : [{
				name : contentName,
				content : contentValue
			}]
		};
		if(type == "schedule template" ) {
			var date = new Date();
			var scheduleTime = date.getTime() +( sendAt * 60000);
			msg = 'Mail has been scheduled successfully  to ' + obj.email + ' and it will be send at '
			 + new Date(scheduleTime) + ' through Mandrill';
			postData.send_at = new Date(scheduleTime);
		}
		var args = {
			data : postData,
			headers : {
				Accept : "application/json",
				"Content-Type" : "application/json"
			}
		};
		client.post(newUrl, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					if(data[0].hasOwnProperty("status") && data[0].status.toLowerCase() == "invalid") {
						errMsg = "Invalid Email. Please provide a valid email";
						emitter.emit('error', errMsg,args.data, newUrl, node);
					}
		           	post(data, node, msg);
		        } else {
		        	if(data.hasOwnProperty("message")) {
		        		errMsg = data.message;
		        	}
		            emitter.emit('error',errMsg, args.data, newUrl, node);
		        }
	       	} catch(e) {
				emitter.emit('error',e.message, e.stack, "", node);
			}
		}).on('error', function(err) {
			emitter.emit('error',errMsg, args.data, newUrl, node);
		});
	} catch(e) {
		emitter.emit('error',e.message, e.stack, "", node);
	}
}

function sendMail(url,  type, node) {
	try {
		var obj = node.reqData;
		var newUrl = url + "send.json";
		var msg = 'Mail has been sent successfully to ' + obj.email + ' through Mandrill';
		var postData = {
			key : apiKey,
			message : {
				from_email : fromAddress,
				from_name : fromName,
				subject : mailSubject,
				text : textMessage,
				to : [{
					email : obj.email,
					name : fromName
				}]
			}
		};
		if(type == "schedule mail" ) {
			var date = new Date();
			var scheduleTime = date.getTime() +( sendAt * 60000);
			msg = 'Mail has been scheduled successfully  to ' + obj.email + ' and it will be send at '
			 + new Date(scheduleTime) + ' through Mandrill';
			postData.send_at = new Date(scheduleTime);
		}
		var args = {
			data : postData,
			headers : {
				Accept : "application/json",
				"Content-Type" : "application/json"
			}
		};
		client.post(newUrl, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					if(data[0].hasOwnProperty("status") && data[0].status.toLowerCase() == "invalid") {
						errMsg = "Invalid Email. Please provide a valid email";
						emitter.emit('error', errMsg,args.data, newUrl, node);
					}
		           	post(data, node, msg);
		        } else {
		        	if(data.hasOwnProperty("message")) {
		        		errMsg = data.message;
		        	}
		            emitter.emit('error',errMsg, args.data, newUrl, node);
		        }
	        } catch(e) {
				emitter.emit('error',e.message, e.stack, "", node);
			}
		}).on('error', function(err) {
			emitter.emit('error',errMsg, args.data, newUrl, node);
		});
	} catch(e) {
		emitter.emit('error',e.message, e.stack, "", node);
	}
}

function sendFile(url,  type, node) {
	try {
		var obj = node.reqData;
		var fileContent = fs.readFileSync(obj.fileUrl, 'base64');
		var newUrl = url + "send.json";
		var msg = 'Mail has been sent successfully to ' + obj.email + ' through Mandrill';
		var postData = {
			key : apiKey,
			message : {
				from_email : fromAddress,
				from_name : fromName,
				subject : mailSubject,
				text : textMessage,
				to : [{
					email : obj.email,
					name : fromName
				}],
				attachments : [{
					type : obj.fileType,
					name : obj.fileName,
					content : fileContent
				}]
			}
		};
		if(type == "schedule file" ) {
			var date = new Date();
			var scheduleTime = date.getTime() +( sendAt * 60000);
			msg = 'Mail has been scheduled successfully  to ' + obj.email + ' and it will be send at '
			 + new Date(scheduleTime) + ' through Mandrill';
			postData.send_at = new Date(scheduleTime);
		}
		var args = {
			data : postData,
			headers : {
				Accept : "application/json",
				"Content-Type" : "application/json"
			}
		};
		client.post(newUrl, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					if(data[0].hasOwnProperty("status") && data[0].status.toLowerCase() == "invalid") {
						errMsg = "Invalid Email. Please provide a valid email";
						emitter.emit('error', errMsg,args.data, newUrl, node);
					}
		           	post(data, node, msg);
		        } else {
		        	if(data.hasOwnProperty("message")) {
		        		errMsg = data.message;
		        	}
		            emitter.emit('error',errMsg, args.data, newUrl, node);
		        }
	        } catch(e) {
				emitter.emit('error',e.message, e.stack, "", node);
			}
		}).on('error', function(err) {
			emitter.emit('error',errMsg, args.data, newUrl, node);
		});
	} catch(e) {
		emitter.emit('error',e.message, e.stack, "", node);
	}
}

function post(Response, node, message) {
	node.resData = Response;
	emitter.emit('success', node, message);
}

function testApp(callback) {
	try {
		var url = 'https://mandrillapp.com/api/1.0/users/ping.json';
		var args = {
			data : { key : apiKey }
		};
		var result;
		client.post(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					result = {
		                status :'success',
		                response: data
		            };
		        } else {
		        	if(data.hasOwnProperty("message")) {
		        		errMsg = data.message;
		        	} 
		        	result = {
		                status :'error',
		                response: errMsg
		            };
		        }
		        callback(result);
		    } catch(e) {
				callback({status:"error", response:e.stack});
			}
		}).on('error', function(err) {
			callback({status:"error", response:e.stack});
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
		var type = node.option.toLowerCase();
		var credentials = node.credentials;
		apiKey = credentials.apiKey;
		fromName = credentials.fromName;
		fromAddress = credentials.fromAddress;
		mailSubject = credentials.mailSubject;
		textMessage = credentials.textMessage;
		if (type == "schedule mail" ) {
			sendAt = credentials.sendAt;
		} else if(type == "template") {
			templateName = credentials.templateName;
		} else  if(type == "schedule template") {
			sendAt = credentials.sendAt;
			templateName = credentials.templateName;
		}
		run(node);
	} catch(e) {
		emitter.emit('error',e.message, e.stack, "", node);
	}
}

var Mandrill = {
	init :  init,
	test : test
};

module.exports = Mandrill;