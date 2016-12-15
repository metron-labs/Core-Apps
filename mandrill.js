var Client = require('node-rest-client').Client;
var client = new Client();

// var emitter = require('../javascripts/emitter');

var apiKey, fromName, fromAddress, mailSubject, textMessage, sendAt, templateName;
var errMsg = 'Something went wrong on the request';

function run(node) {
	var type = node.connection.option.toLowerCase();
	var url = "https://mandrillapp.com/api/1.0/messages/";
	if(type == "template" || type  == "schedule template") {
		sendTemplate(url, type, node);
	} else  {
		sendMail(url, type, node);
	}
}

function sendTemplate(url, type, node) {
	var obj = node.requestData;
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
		postData.send_at = new Date(scheduleTime);
	}
	var args = {
		data : postData,
		headers : {
			Accept : "application/json",
			"Content-Type" : "application/json"
		}
	};
	console.log('postData.............%j', postData);
	client.post(newUrl, args, function(data, res) {
		var status = parseInt(res.statusCode/100);
		if(status == 2) {
			if(data[0].hasOwnProperty("status") && data[0].status.toLowerCase() == "invalid") {
				errMsg = "Invalid Email. Please provide a valid email";
				console.log(errMsg);
				// emitter.emit('error', errMsg,args.data, newUrl, node);
			}
           post(data, node);
        } else {
        	if(data.hasOwnProperty("message")) {
        		errMsg = data.message;
        	}
            console.log(errMsg);
            // emitter.emit('error',errMsg, args.data, newUrl, node);
        }
	}).on('error', function(err) {
		console.log(errMsg,err.request.options);
		// emitter.emit('error',errMsg, args.data, newUrl, node);
	});
}

function sendMail(url,  type, node) {
	var obj = node.requestData;
	var newUrl = url + "send.json";
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
		var status = parseInt(res.statusCode/100);
		if(status == 2) {
			if(data[0].hasOwnProperty("status") && data[0].status.toLowerCase() == "invalid") {
				errMsg = "Invalid Email. Please provide a valid email";
				console.log(errMsg);
				// emitter.emit('error', errMsg,args.data, newUrl, node);
			}
           post(data, node);
        } else {
        	if(data.hasOwnProperty("message")) {
        		errMsg = data.message;
        	}
            console.log(errMsg);
            // emitter.emit('error',errMsg, args.data, newUrl, node);
        }
	}).on('error', function(err) {
		console.log(errMsg,err.request.options);
		// emitter.emit('error',errMsg, args.data, newUrl, node);
	});
}

function post(Response, node) {
	console.log("Mandrill Response: %j", Response);
	node.resData = Response;
	// emitter.emit('success', node);
}

function testApp() {
	var url = 'https://mandrillapp.com/api/1.0/users/ping.json';
	var args = {
		data : { key : apiKey }
	};
	var result;
	client.post(url, args, function(data, res) {
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
        console.log(result);
        return result;
	}).on('error', function(err) {
		console.log(errMsg,err.request.options);		
	});
}

module.exports = (function() {
	var Mandrill = {
		init : function(node) {
			var type = node.connection.option.toLowerCase();
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
		},
		test(request) {
			var credentials = request.credentials;
			apiKey = credentials.apiKey;
			testApp();
		}
	};
	return Mandrill;
})();