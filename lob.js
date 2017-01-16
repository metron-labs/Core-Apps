var Client = require('node-rest-client').Client;
var client = new Client();

var emitter = require('../core-integration-server-v2/javascripts/emitter');

var apiKey, frontFileUrl, backFileUrl, textMessage;
var offset = 0, count, finalDataArr = [];

var errMsg = 'Error in connecting Lob';

function run(node) {
	try {
		var nodeType = node.connector.type.toLowerCase();
		if(nodeType == 'trigger') {
			getPostCards(node);
		} else {
			createPostCard(node);
		}
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	} 
}

function getPostCards(node) {
	try {
		var url = 'https://api.lob.com/v1/postcards?limit=100&include[]=total_count';
		if(offset != 0) {
			url += '&offset=' + offset;
		}
		var args = {
			headers :{ 
				Authorization : 'Basic ' + b64EncodeUnicode(apiKey + ':' + ''),
				Accept : 'application/json'
			 }
		};
		client.get(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					count = data.total_count;
					formCustomer(data.data, node);
				} else {
					if(data.hasOwnProperty('error')) {
						errMsg = data.error.message;
					}
					emitter.emit('error', errMsg, '', url, node);
				}
			} catch(e) {
				emitter.emit('error', e.message, e.stack, '', node);
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, '', url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	} 
}

function formCustomer(dataArr, node) {
	try {
		var resArr = [];
		var resObj, obj;
		var actionName = node.connection.actionName.toLowerCase();
		for(var i = 0; i < dataArr.length; i++) {
			resObj = {};
			obj = dataArr[i];
			resObj.id  = obj.id;
			resObj.firstName = obj.to.name;
			resObj.email = obj.to.email;
			resObj.createdAt = obj.date_created;
			resObj.updatedAt = obj.date_modified;
			var addr = {};
			addr.name = obj.to.name;
			addr.company = obj.to.company;
			addr.phone = obj.to.phone;
			addr.street = obj.to.address_line1;
			addr.city = obj.to.address_city;
			addr.state = obj.to.address_state;
			addr.country = obj.to.address_country;
			addr.zip = obj.to.address_zip;
			resObj.defaultAddress = addr;
			resObj.isLast = false;
			resObj.slackFlag = false;
			if(actionName == 'slack' && i == 0) {
				resObj.slackFlag = true;
			}
			if(i == count) {
				resObj.isLast = true;
			}			
			resArr[i] = resObj;
		}
		post(resArr, node, '');
		finalDataArr = finalDataArr.concat(resArr);
		if(finalDataArr.length != count) {
			offset += 100;
			getPostCards(node);
		}
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function createPostCard(node) {
	try {
		var url = 'https://api.lob.com/v1/postcards';
		var reqObj = node.reqData;
		var name, street, city, state, country, zip, phone, company;
		if(reqObj.hasOwnProperty("shippingAddress")) {
			name = reqObj.billingAddress.name;
			street = reqObj.billingAddress.street;
			city = reqObj.billingAddress.city;
			state = reqObj.billingAddress.state;
			country = reqObj.billingAddress.country;
			zip = reqObj.billingAddress.zip;
			phone = reqObj.billingAddress.phone;
			company = reqObj.billingAddress.company;
		} else {
			name = reqObj.firstName;
			street = reqObj.defaultAddress.street;
			city = reqObj.defaultAddress.city;
			state = reqObj.defaultAddress.state;
			country = reqObj.defaultAddress.countryISO2;
			zip = reqObj.defaultAddress.zip;
			phone = reqObj.defaultAddress.phone;
			company = reqObj.defaultAddress.company;
		}
		var front, back;
		if(frontFileUrl == '') {
			front = reqObj.fileUrl;
		} else {
			front = frontFileUrl;
		}
		if(backFileUrl != '') {
			back = backFileUrl;
		} else {
			var backUrl = 'http://neemtecsolutions.com/corehq/poster_header.png';
			back = "<html><div style='margin:-8px'><img src='" + backUrl
				+ "' height='100' width='100%' style='margin:0px'/></div><div style='position:absolute; width:35%;padding:30px; font-size:14px'>"
				+ escapeHtml(textMessage) + "</div></html>";
		}
		var postData = {			
			to : {
				name : name,				
				address_line1 : street,
				address_city : city,
				address_state : state,
				address_country : country,
				address_zip : zip,
				email : reqObj.email,
				phone: phone
			},
			front : front,
			back : back,
			description : 'CORE POSTCARD'
		};
		var args = {
			data : postData,
			headers : { 
				Authorization : 'Basic ' + b64EncodeUnicode(apiKey + ':' + ''),
				Accept : 'application/json',
				'Content-Type' : 'application/json'
			}
		};
		client.post(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					var msg = 'Postcard successfully created for the customer ' + reqObj.email + ' in Lob';
					post(data, node, msg);
				} else {
					if(data.hasOwnProperty('error')) {
						errMsg = data.error.message;
					}
					emitter.emit('error', errMsg, data, url, node);
				}
			} catch(e) {
				emitter.emit('error', e.message, e.stack, url, node);
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, '', url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function post(response, node, message) {
	node.resData = response;
	emitter.emit('success', node, message);
}

function escapeHtml(str) {
	return str.replace(/[\u00A0-\u99999<>\&\?\'\"\#\$\¢\£\€\©\®]/gim, function(i) {
        return '&#'+i.charCodeAt(0)+';';
    });
}

function b64EncodeUnicode(string) {
	return new Buffer(string).toString('base64');
}

function testApp(callback) {
	try {
		var url = 'https://api.lob.com/v1/postcards' ;
		var args = {
			headers :{ 
				Authorization : 'Basic ' + b64EncodeUnicode(apiKey + ':' + ''),
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
						response : data
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

function test(request, callback) {
	try {
		var credentials = request.credentials;
		apiKey = credentials.apiKey;
		testApp(callback)
	} catch(e) {
		callback({status:'error', response: e.stack});
	} 
}

function init(node) {
	try {
		var credentials = node.credentials;
		apiKey = credentials.apiKey;
		var trigger = node.connection.triggerName.toLowerCase();
		if(trigger != 'handwriting') {
			frontFileUrl = credentials.frontFileUrl;
		}
		if(credentials.hasOwnProperty('backFileUrl')) {
			backFileUrl = credentials.backFileUrl;
		}		
		textMessage = credentials.textMessage;
		run(node);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	} 
}

var Lob = {
	init : init,
	test : test
};

module.exports = Lob;