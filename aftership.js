var Client = require('node-rest-client').Client;
var client = new Client();
var moment = require('moment-timezone');

var emitter = require('../core-integration-server-v2/javascripts/emitter');
var apiKey;
var errMsg = 'Error in connecting Aftership';

function run(node) {
	try {
		var nodeType =  node.connector.type.toLowerCase();
		var type = node.option.toLowerCase();
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
		var url = "https://api.aftership.com/v4/trackings";
		var args = {
			headers : {
				'aftership-api-key' : apiKey,
				'Content-Type' : "application/json"
			}
		};
		var filterDate = null;
		if(node.optionType.toLowerCase() == 'new') {
			var pathStartTime = node.connection.startedAt;
			var arr = pathStartTime.split('/');
			var formattedDateStr = arr[1] + '/' + arr[0] + '/' + arr[2];
			var startDate = new Date(formattedDateStr);
			filterDate = toTimeZone(startDate, "YYYY-MM-DDTHH:mm:ss", "EST");			
		}
		if(filterDate != null) {
			url += "?created_at_min=" + filterDate;
		}
		client.get(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					getOrders(data.data.trackings, url, type, node);
				}  else {
					if(status == 5) {
						emitter.emit('error', 'Server Error in Aftership', '', url, node);
					}
					if(data.hasOwnProperty('meta')) {
						errMsg = data.meta.message;
					}
					emitter.emit('error', errMsg, args.data, url, node);
				}
			} catch(e) {
				emitter.emit('error', e.message, e.stack, "", node);
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, '', url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function toTimeZone(time, format, zone) {
	return moment(time).tz(zone).format(format);
}

function getOrders(trackingsArr, url, type, node) {
	try {
		var actionName = node.connection.actionName.toLowerCase();
		var resArr = [];
		var resObj, obj;
		for(var i = 0; i < trackingsArr.length; i++) {
			obj = trackingsArr[i];
			resObj = {};
			cusObj = obj.custom_fields;
			resObj.id = obj.id;
			resObj.email = obj.emails[0];
			resObj.price = cusObj.total_price;
			resObj.name = obj.id;
			resObj.createdAt = obj.created_at;
			resObj.updatedAt = obj.updated_at;
			var billingAddress = {};
			var billingObj;
			if(cusObj.hasOwnProperty('billing_address')) {
				billingObj = cusObj.billing_address;
				billingAddress.name = billingObj.name;
				billingAddress.street = billingObj.address;
				billingAddress.city = billingObj.city;
				billingAddress.state = billingObj.state;
				billingAddress.country = billingObj.country;
				billingAddress.zip = billingObj.zip;
				billingAddress.phone = billingObj.phone
			}
			resObj.billingAddress = billingAddress;
			var shippingAddress = {};
			var shippingObj;
			if(cusObj.hasOwnProperty('shipping_address')) {
				shippingObj = cusObj.shipping_address;
				shippingAddress.name = shippingObj.name;
				shippingAddress.street = shippingObj.address;
				shippingAddress.city = shippingObj.city;
				shippingAddress.state = shippingObj.state;
				shippingAddress.country = shippingObj.country;
				shippingAddress.zip = shippingObj.zip;
				shippingAddress.phone = shippingObj.phone;
			}
			resObj.shippingAddress = shippingAddress;
			var itemArr = [];
			if(cusObj.hasOwnProperty('items')) {
				itemArr = cusObj.items;
			} 
			var items = [];
			var item, itemObj;
			for(var j = 0; j < itemArr.length; j++) {
				item = {};
				itemObj = itemArr[j];
				item.name = itemObj.name;
				item.price = itemObj.price;
				item.quantity = itemObj.quantity;
				items[j] = item;
			}
			resObj.items = items;
			resObj.quantity = cusObj.quantity;
			resObj.price = cusObj.total_price;
			resObj.slackFlag = false;
			if(actionName == 'slack' && i == 0) {
				resObj.slackFlag = true;
			}
			resObj.isLast = false;
			if(i == trackingsArr.length-1) {
				resObj.isLast = true;
			}
			resArr[i] = resObj;			
		}
		post(resArr, node, "");
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function postStoreData(type, node) {
	try {
		var reqObj = node.reqData;
		var url = "https://api.aftership.com/v4/trackings";
		var method = node.optionType.toLowerCase();
		var itemsArr = [];
		var itemArr = reqObj.items;
		var itemObj, item;
		for(var i = 0; i < itemArr.length; i++) {
			itemObj = itemArr[i];
			item = {};
			item.name = itemObj.name;
			item.quantity = itemObj.quantity;
			item.price = itemObj.price;
			itemsArr[i] = item;
		}
		var trackingNumber = zeroPad(reqObj.id);
		var trackingList = {
			tracking : {
				tracking_number : trackingNumber,
				title : reqObj.id,
				emails : reqObj.email,
				order_id : reqObj.id,
				custom_fields : {
					items : itemsArr,
					total_price : reqObj.price,
					quantity : reqObj.quantity,
					billing_address : {
						name : reqObj.billingAddress.name,
						address : reqObj.billingAddress.street,
						city : reqObj.billingAddress.city,
						state : reqObj.billingAddress.state,
						country : reqObj.billingAddress.country,
						zip : reqObj.billingAddress.zip,
						phone : reqObj.billingAddress.phone
					},
					shipping_address : {
						name : reqObj.shippingAddress.name,
						address : reqObj.shippingAddress.street,
						city : reqObj.shippingAddress.city,
						state : reqObj.shippingAddress.state,
						country : reqObj.shippingAddress.country,
						zip : reqObj.shippingAddress.zip,
						phone : reqObj.shippingAddress.phone
					}
				},
				customer_name : reqObj.billingAddress.name
			}	
		}		
		var args = {
			data : trackingList,
			headers : {
				'aftership-api-key' : apiKey,
				'Content-Type' : "application/json"
			}
		};
		client.post(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				var msg;
				if(status == 2) {
					msg = "Tracking for the order" + reqObj.id + "has been created successfully in Aftership";
					post(data, node, msg);
				} else {
					if(status == 5) {
						emitter.emit('error', 'Server Error in Aftership', '', url, node);
					}
					if(data.hasOwnProperty('meta')) {
						errMsg = data.meta.message;
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

function zeroPad(num, places) {
	var places = 10;
  var zero = places - num.toString().length + 1;
  return Array(+(zero > 0 && zero)).join("0") + num;
}

function post(response, node, message) {
	node.resData = response;
	emitter.emit('success', node, message);
}

function testApp(callback) {
	try {
		var url = "https://api.aftership.com/v4";
		var args = {
			headers : {
				'aftership-api-key' : apiKey,
				'Content-Type' : "application/json"
			}
		};
		client.get(url, args, function(data, res) {
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
		callback({status:'error', response:e.stack});
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

var Aftership = {
	init : init,
	test : test
};

module.exports = Aftership;