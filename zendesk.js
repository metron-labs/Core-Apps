var Client = require('node-rest-client').Client;
var async = require('async');
var client = new Client();

var emitter = require('../core-integration-server-v2/javascripts/emitter');

var apiToken, agentMailId, subDomain, ticketSubject, ticketComment;
var errMsg = 'Error in connecting  Zendesk';

function run(node) {
	try {
		var nodeType = node.connector.type.toLowerCase();
		var type = node.option.toLowerCase();	
		var url = 'https://' + subDomain + '.zendesk.com/api/v2/';
		if(type != 'ticket') {
			type = 'user';
		}
		if(nodeType == 'trigger') {			
			getStoreData(url, type, node);
		} else {
			postDataModel(url, type, node);
		}
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function getStoreData(url, type, node) {
	try {
		if(type == 'ticket') {
			url += 'tickets.json';
		} else {
			url += 'users.json';
		}	
		var args = {
			headers : {
				Authorization : 'Basic ' + b64EncodeUnicode(agentMailId + '/token:' + apiToken),
				Accept : 'application/json'
			}
		};
		client.get(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					if(type == 'ticket') {						
						formCustomerFromTicket(data.tickets, node);						
					} else {
						formCustomer(data.users, node);
					}	
					var nextPage = data.next_page;
					if(nextPage != null) {
						getStoreData(nextPage, type, node);
					}				
				} else {
					emitter.emit('error', data.error, args.data,url, node);		
				}
			} catch(e) {
				emitter.emit('error', e.message, e.stack, url, node);
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, args.data, url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function formCustomer(dataArr, node) {
	try {
		var resArr = [];
		var obj, resObj;
		for(var i = 0; i < dataArr.length; i++) {
			resObj = {};
			obj = dataArr[i];
			resObj.id = obj.id;
			resObj.firstName = obj.name;
			resObj.email = obj.email;
			resObj.createdAt = obj.creadted_at;
			resObj.updatedAt = obj.updated_at;
			resArr[i] = resObj;
		}
		post(resArr, node, '');
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function formCustomerFromTicket(dataArr, node) {
	try {
		var resArr = [];
		var obj, resObj;
		for(var i = 0; i < dataArr.length; i++) {
			resObj = {};
			obj = dataArr[i];
			resObj.id = obj.requester_id;
			resObj.errMessage = obj.description;
			resObj.errSubject = obj.subject;	
			resArr[i] = resObj;		
		}
		getUserDetails(resArr, node);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function getUserDetails(dataArr, node) {
	try {	
		var length = dataArr.length;	
		async.forEach(dataArr, function(obj) {
			var url = 'https://' + subDomain + '.zendesk.com/api/v2/users/' + obj.id + '.json';
			var args = {
				headers : {
					Authorization : 'Basic ' + b64EncodeUnicode(agentMailId + '/token:' + apiToken),
					Accept : 'application/json'
				}
			};
			client.get(url, args, function(data, res) {
				try {
					length--;
					var status = parseInt(res.statusCode/100);
					if(status == 2) {
						obj.firstName = data.name;
						obj.email = data.email;
						obj.createdAt = data.creadted_at;
						obj.updatedAt = data.updated_at;
						if(length == 0) {
							post(dataArr, node, '');
						}
					} else {
						emitter.emit('error', data.error, '', node);
					}
				} catch(e) {
					emitter.emit('error', e.message, e.stack, url, node);
				}
			}).on('error', function(err) {
				emitter.emit('error', err, args.data, url, node);
			});
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function postDataModel(url, type, node) {
	try {
		var option = node.optionType.toLowerCase();
		if(option == 'update') {
			updateStoreData(url, type, node);
		} else {			
			postTicketOrUser(url, type, option, node);
		}
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function getId(url, type, node, callback) {
	try {
		var reqObj = node.reqData;
		var query = 'type:' + type +'"'+ reqObj.email + '"';
		var newUrl = url + 'search.json?query=' + encodeURIComponent(query);
		var args = {
			headers : {
				Authorization : 'Basic ' + b64EncodeUnicode(agentMailId + '/token:' + apiToken),
				Accept : 'application/json'
			}
		};
		var option = node.optionType.toLowerCase();
		client.get(newUrl, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					var results = data.results;
					if(results.length == 0){
						postTicketOrUser(url, type, option, node);
					} else {
						var id = data.results[0].id;
						callback(id);
					}
				} else {
					if(data.hasOwnProperty('description')) {
						errMsg = data.description;
					}
					if(data.hasOwnProperty('error')){
						errMsg = data.error;
					}
					emitter.emit('error', errMsg, '', newUrl, node);
				}
			} catch(e) {
				emitter.emit('error', e.message, e.stack, '', node);
			}	
		}).on('error', function(err) {
			emitter.emit('error', errMsg, '', newUrl, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function updateStoreData(url, type, node) {
	try {
		var reqObj = node.reqData;
		var name, msg;
		if(reqObj.hasOwnProperty('shippingAddress')) {
			name = reqObj.shippingAddress.name;			
		} else {
			name = reqObj.firstName;
		}
		var userData = {
			name : name,
			email : reqObj.email
		};
		var postData;
		if(type == 'user') {
			postData = {
				user : userData,
			};
			msg = 'User with email ' + reqObj.email + ' has been updated successfully in Zendesk';
		} else {
			postData = {
				ticket : {
					requester : userData,
					subject : ticketSubject,				
					comment : {
						body :ticketComment
					}
				}
			};
			msg = 'Ticket with email ' + reqObj.email + ' has been updated successfully in Zendesk';
		}
		var args = {
			data : postData,
			headers :{ 
				Authorization : 'Basic ' + b64EncodeUnicode(agentMailId + '/token:' + apiToken),
				Accept : 'application/json',
				'Content-Type' : 'application/json'
			}
		};
		getId(url, type, node, function(id) {
			if(type == 'ticket') {
				url += 'tickets/' + id + '.json';
			} else {
				url += 'users/' + id + '.json';
			}
			client.put(url, args, function(data, res) {
				try {
					var status = parseInt(res.statusCode/100);
					if(status == 2) {
						post(data, node, msg);
					} else {
						if(data.hasOwnProperty('error')) {
							errMsg = data.error;
						}
						if(data.hasOwnProperty('details')) {
							var details = data.details;
							if(details.hasOwnProperty('email')) {
								if(details.email[0].hasOwnProperty('description')) {
									errMsg = details.email[0].description;
								}
							}
						}
						if(data.hasOwnProperty('base')) {
							var base = data.base;
							errMsg += ',';
							for(var j = 0; j < base.length; j++) {
								errMsg += ' ' + base[j].description;
							}
						}
						emitter.emit('error', errMsg, args.data,url, node);
					}
				} catch(e) {
					emitter.emit('error', e.message, e.stack, url, node);
				}
			}).on('error', function(err) {
				emitter.emit('error', errMsg, args.data, url, node);
			});
		});		
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function postTicketOrUser(url, type, option, node) {
	try {
		var reqObj = node.reqData;
		if(type == 'ticket') {
			url += 'tickets.json';
		} else {
			url += 'users.json';
		}		
		var name, msg;
		if(reqObj.hasOwnProperty('shippingAddress')) {
			name = reqObj.shippingAddress.name;			
		} else {
			name = reqObj.firstName;
		}
		var userData = {
			name : name,
			email : reqObj.email
		};
		var postData;
		if(type == 'ticket') {
			postData = {
				ticket : {
					requester : userData,
					subject : ticketSubject,
					comment : {
						body : ticketComment
					}
				}
			};
			msg = 'Ticket with email ' + reqObj.email + ' has been ' + option + 'd successfully in Zendesk';
		} else {
			postData = {
				user : userData,
			};
			msg = 'User with email ' + reqObj.email + ' has been ' + option +'d successfully in Zendesk';
		}
		var args = {
			data : postData,
			headers :{ 
				Authorization : 'Basic ' + b64EncodeUnicode(agentMailId + '/token:' + apiToken),
				Accept : 'application/json',
				'Content-Type' : 'application/json'
			 }
		};
		client.post(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					post(data, node, msg);
				} else {
					if(data.hasOwnProperty('error')) {
						errMsg = data.error;
					}
					if(data.hasOwnProperty('details')) {
						var details = data.details;
						if(details.hasOwnProperty('email')) {
							if(details.email[0].hasOwnProperty('description')) {
								errMsg = details.email[0].description;
							}
						}
					}
					if(data.hasOwnProperty('base')) {
						var base = data.base;
						errMsg += ',';
						for(var j = 0; j < base.length; j++) {
							errMsg += ' ' + base[j].description;
						}
					}
					emitter.emit('error', errMsg, args.data,url, node);
				}
			} catch(e) {
				emitter.emit('error', e.message, e.stack, url, node);
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, args.data, url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function post(response, node, message) {
	node.resData = response;
	emitter.emit('success', node, message);
}

function b64EncodeUnicode(string) {
	return new Buffer(string).toString('base64');
}

function testApp(callback) {
	try {
		var url = 'https://' + subDomain + '.zendesk.com/api/v2/users.json';
		var args = {
			headers :{ 
				Authorization : 'Basic ' + b64EncodeUnicode(agentMailId + '/token:' + apiToken),
				Accept : 'application/json'
			 }
		};
		client.get(url, args, function(data, res) {
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
						response : data.error
					};
				}
				callback(result);
			} catch(e) {
				callback({status:'error', response: e.stack});
			}
		}).on('error', function(err) {
			callback({status:'error', response: err});
		});
	} catch(e) {
		callback({status:'error', response: e.stack});
	}
}

function init(node) {
	try {
		var credentials = node.credentials;
		apiToken = credentials.apiToken;
		agentMailId = credentials.agentMailId;
		subDomain = credentials.subDomain;
		var type = node.option.toLowerCase();
		if(type == 'ticket') {
			ticketSubject = credentials.ticketSubject;
			ticketComment = credentials.ticketComment;
		}		
		run(node);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function test(request, callback) {
	try {
		var credentials = request.credentials;
		apiToken = credentials.apiToken;
		agentMailId = credentials.agentMailId;
		subDomain = credentials.subDomain;
		testApp(callback);
	} catch(e) {
		callback({status : 'error', response : e.stack});
	}
}

var Zendesk = {
	init : init,
	test : test
};

module.exports = Zendesk;