var Client = require('node-rest-client').Client;
var client = new Client();

var emitter = require('../core-integration-server-v2/javascripts/emitter');
var apiKey, apiPassword, siteName, caseSubject, fromEmail, subject, message, actionName;
var errMsg = '"Connection timeout error" in Desk';

function run(node) {
	try {
		var nodeType =  node.connector.type.toLowerCase();
		var type = node.option.toLowerCase();
		actionName = node.connection.actionName.toLowerCase();
		var reqObj = node.reqData;
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
		var url = "https://" + siteName + ".desk.com/api/v2/customers";
		var args = {
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword),
				Accept : "application/json"
			}
		};
		client.get(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					formCustomer(data._embedded.entries, node);
				} else {
					if(status == 5) {
						emitter.emit('error', 'Server Error in Desk', '', url, node);
					}
					if(data.hasOwnProperty('message')) {
						errMsg = data.message;
					}
					if(data.hasOwnProperty('errors')) {
						errMsg = data.errors;
						if(data.errors.hasOwnProperty('emails')) {
							errMsg = 'Email ' + reqObj.email + ' has already ' + data.errors.emails[0].value[0];
						}
					}
					emitter.emit('error', errMsg, data, url, node);
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

function formCustomer(customerArr, node) {
	try {
		var resArr = [];
		var obj, resObj;
		if(customerArr.length == 0) {
			emitter.emit('error', 'No data found in desk', '', "", node);
		}
		for (var i = 0; i < customerArr.length; i++) {
			resObj = {};
			obj = customerArr[i];
			resObj.id = obj.id;
			resObj.firstName = obj.first_name;
			resObj.lastName = obj.last_name;
			resObj.email = obj.emails[0].value;
			resObj.createdAt = obj.created_at;
			resObj.updatedAt = obj.updated_at;
			resObj.slackFlag = false;
			if(actionName == 'slack' && i == 0) {
				resObj.slackFlag = true;
			}
			resObj.isLast = false;
			if(i == customerArr.length-1) {
				resObj.isLast = true;
			}
			resArr[i] = resObj;
		}
		post(resArr, node, '');
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function postStoreData(type, node) {
	try {
		var reqObj = node.reqData;
		var url = "https://" + siteName + ".desk.com/api/v2/";
		var method = node.optionType.toLowerCase();
		if(method == "update") {
			updateStoreData(url, node, type);
		} else if(type == "case") {
			url += "cases";
			postCase(url, node, type);
		} else {
			url += "customers";
			postCustomer(url, node, type);
		}
	} catch(e) {
        emitter.emit('error', e.message, e.stack, "", node);
    }
	
}

function postCase(url, node, type) {
	try {
		var reqObj = node.reqData;
		var postData = {
			type : 'email',
			subject : caseSubject,
			status : 'open',
			message : {
				from : fromEmail,
				to : reqObj.email,
				status : 'received',
				subject : subject,
				body : message,
				direction : 'in'
			}
		};
		var args = {
			data : postData,
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword),
				Accept : "application/json",
				"Content-Type" : "application/json"
			}
		};
		client.post(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				var msg;
				if(status == 2) {
					msg = "Case for " + reqObj.email + " created successfully in Desk.";
					post(data, node, msg);
				} else {
					if(status == 5) {
						emitter.emit('error', 'Server Error in Desk', '', url, node);
					}					
					if(data.hasOwnProperty('message')) {
						errMsg = data.message;
					}
					if(data.hasOwnProperty('errors')) {
						errMsg = data.errors;
						if(data.errors.hasOwnProperty('emails')) {
							errMsg = 'Email ' + reqObj.email + ' has already ' + data.errors.emails[0].value[0];
						}
					}
					emitter.emit('error', errMsg, data, url, node);
				}
			} catch(e) {
				emitter.emit('error', e,message, e.stack, url, node);
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, args.data, url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function postCustomer(url, node, type) {
	try {
		var reqObj = node.reqData;
		var name, company = '', lastName;
		if(reqObj.hasOwnProperty("shippingAddress")) {
			name = reqObj.shippingAddress.name;
			if(reqObj.shippingAddress.hasOwnProperty("company")) {
				company = reqObj.shippingAddress.company;
			}
			lastName = '';
		} else {
			name = reqObj.firstName;
			if(reqObj.hasOwnProperty("defaultAddress")) {
				if(reqObj.defaultAddress.hasOwnProperty("company")) {
					company = reqObj.defaultAddress.company;
				}
				lastName = reqObj.defaultAddress.lastName;
			}
		}

		var postData = {
			first_name : name,
			last_name : lastName,
			company : company,
			emails : [{
				type : 'work',
				value : reqObj.email
			}]
		};
		var args = {
			data : postData,
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword),
				Accept : "application/json",
				"Content-Type" : "application/json"
			}
		};
		client.post(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				var msg;
				if(status == 2) {
					msg = "Customer for " + reqObj.email + " created successfully in Desk.";
					post(data, node, msg);
				} else {
					if(status == 5) {
						emitter.emit('error', 'Server Error in Desk', '', url, node);
					}					
					if(data.hasOwnProperty('message')) {
						errMsg = data.message;
					}
					if(data.hasOwnProperty('errors')) {
						errMsg = data.errors;
						if(data.errors.hasOwnProperty('emails')) {
							errMsg = 'Email ' + reqObj.email + ' has already ' + data.errors.emails[0].value[0];
						}
					}
					emitter.emit('error', errMsg, data, url, node);
				}
			} catch(e) {
				emitter.emit('error', e,message, e.stack, url, node);
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, args.data, url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node)
	}
}

function updateStoreData(url, node, type) {
	try {
		var reqObj = node.reqData;
		url += "customers"
		var name, company;
		if(reqObj.hasOwnProperty("shippingAddress")) {
			name = reqObj.shippingAddress.name;
			if(reqObj.shippingAddress.hasOwnProperty("company")) {
				company = reqObj.shippingAddress.company;
			}
		} else {
			name = reqObj.firstName;
			if(reqObj.hasOwnProperty("defaultAddress")) {
				if(reqObj.defaultAddress.hasOwnProperty("company")) {
					company = reqObj.defaultAddress.company;
				}
			}
		}
		var postData = {
			type : 'email',
			subject : caseSubject,
			status : 'open',
			message : {
				from : fromEmail,
				to : reqObj.email,
				status : 'received',
				subject : subject,
				body : message,
				direction : 'in'
			}
		};
		var args = {
			data : postData,
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword),
				Accept : "application/json",
				"Content-Type" : "application/json"
			}
		};
		getCustomerId(url, node, type, function(id) {
			url += "/" + id;
			client.put(url, args, function(data, res) {
				try {
					var status = parseInt(res.statusCode/100);
					var msg;
					if(status == 2) {
						if(type == 'case') {
							msg = "Case for " + reqObj.email + " updated successfully in Desk.";
							post(data, node, msg);
						} else {
							msg = "Customer for " + reqObj.email + " updated successfully in Desk.";
							post(data, node, msg);
						}
					} else {
						if(status == 5) {
							emitter.emit('error', 'Server Error in Desk', '', url, node);
						}
						if(data.hasOwnProperty('message')) {
							errMsg = data.message;
						}
						emitter.emit('error', errMsg, data, url, node);
					}
				} catch(e) {
					emitter.emit('error', e.message, e.stack, url, node);
				}
			}).on('error', function(err) {
				emitter.emit('error', errMsg, args.data, url, node);
			});
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function getCustomerId(url, node, type, callback) {
	try {
		var reqObj = node.reqData;
		var customerId;
		var newUrl = url + '/search?first_name=' + reqObj.firstName;
		var args = {
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword),
				Accept : "application/json"
			}
		};
			client.get(newUrl, args, function(data, res) {
				try {
					var status = parseInt(res.statusCode/100);
					if(status == 2) {
						var customers = data._embedded.entries;
						if(customers.length == 0) {
							postCustomer(url, node, type);
						} else {
							var id = data._embedded.entries[0].id;
							callback(id);
						}
					} else {
if(status == 5) {
        				emitter.emit('error', 'Server Error in Desk', '', url, node);
        			}
						if(data.hasOwnProperty('message')) {
							errMsg = data.message;
						}
						emitter.emit('error', errMsg, data, newUrl, node);
					}
				} catch(e) {
					emitter.emit('error', e.message, e.stack, '', node);
				}
			}).on('error', function(err) {
				emitter.emit('error', err, '', newUrl, node);
			});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function post(response, node, message) {
	node.resData = response;
	emitter.emit('success', node, message);
}

function b64EncodeUnicode(str) {
    return new Buffer(str).toString('base64');
}

function testApp(callback) {
	try {
		var url = "https://" + siteName + ".desk.com/api/v2/customers";
		var args = {
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword),
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
				} else {
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
		apiPassword = credentials.password;
		siteName = credentials.siteName;
		testApp(callback);
	} catch(e) {
		callback({status:"error", response:e.stack});
	}
}

function init(node) {
	try {
		var credentials = node.credentials;
		apiKey = credentials.apiKey;
		apiPassword = credentials.password;
		siteName = credentials.siteName;
		caseSubject = credentials.caseSubject;
		fromEmail = credentials.fromEmail;
		subject = credentials.subject;
		message = credentials.message;
		run(node);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

var Desk = {
	init : init,
	test : test
};

module.exports = Desk;