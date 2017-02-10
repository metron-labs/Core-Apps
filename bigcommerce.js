var Client = require('node-rest-client').Client;
var client = new Client();
var moment = require('moment-timezone');
var async = require('async');

var emitter = require('../core-integration-server-v2/javascripts/emitter');

var url, userName, apiToken, actionName, finalDataArr = [], page = 1, count;
var errMsg = '"Connection time out error" in Bigcommerce';

function run(node) {
	try { 
		var nodeType =  node.connector.type.toLowerCase();
		var type = node.option.toLowerCase();
		var reqObj = node.reqData;
		getDataCount(node);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function getDataCount (node) {
	try {
		actionName = node.connection.actionName.toLowerCase();
		var type =  node.option.toLowerCase();
		var newUrl;
		var args = {
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(userName + ":" + apiToken),
				"Content-Type": 'application/json',
				Accept : "application/json"
			}
		};
		if(type == "customer") {
			newUrl = url + "/customers/count.json";
		} else if(type == "product") {
			newUrl = url + "/products/count.json";
		} else if(type == "order") {
			newUrl = url + "/orders/count.json";
		}
		client.get(newUrl, args, function(data, res) {
			try {
				var statusCode = parseInt(res.statusCode/100);
				if(statusCode == 2) {
					count = data.count;
					var dataUrl;
					if(type == "customer") {
						dataUrl = url + "/customers.json?page=" + page ;
					} else if(type == "product") {
						dataUrl = url + "/products.json?page=" + page;
					} else if(type == "order") {
						dataUrl = url + "/orders.json?page=" + page ;
					}
					getStoreData(dataUrl, args, type, node);
				}
			} catch(e) {
				emitter.emit('error',e.message, e.stack, newUrl, node);
			}
		}).on('error', function(err) {
			emitter.emit("error",errMsg,"", newUrl, node);
		});
	} catch(e) {
		emitter.emit('error',e.message, "", "", node);
	}
}

function getStoreData(dataUrl, args, type, node) {
	try {
		actionName = node.connection.actionName.toLowerCase();
		var type =  node.option.toLowerCase();
		var newUrl = dataUrl, filterDate = null;
		if(node.optionType.toLowerCase() == 'new') {
			var pathStartTime = node.connection.startedAt;
			var arr = pathStartTime.split('/');
			var formattedDateStr = arr[1] + '/' + arr[0] + '/' + arr[2];
			var startDate = new Date(formattedDateStr);
			filterDate = toTimeZone(startDate, "YYYY-MM-DDTHH:mm:ss", "EST");
		}
		if(filterDate != null) {
			newUrl += "&min_date_created=" + filterDate;
		}
		client.get(newUrl, args, function(data, res) {
			try {
				var statusCode = parseInt(res.statusCode/100);
				var msgPrefix = 'No ';
				if(node.optionType.toLowerCase() == 'new') {
					msgPrefix = 'No new ';
				}
				if(statusCode == 2) {
					if(res.statusCode == 204) {
						emitter.emit('error', msgPrefix + type + 's found in Bigcommerce', '', newUrl, node);
					} else {
						if (type == "customer") {
							setCustomer(data, node);
						} else if (type == "product") {
							setProduct(data, node);
						} else if(type == "order") {
							setOrder(data, node);
						}
					}
				} else {
					if(statusCode == 5) {
						emitter.emit('error', 'Server Error in Bigcommerce', '', newUrl, node);
					}
					if(data[0].hasOwnProperty('message')) {
						errMsg = data[0].message;
					}
					if(data[0].hasOwnProperty('details')) {
						if(data[0].details.hasOwnProperty('invalid_reason')) {
							errMsg += ' ' + data[0].details.invalid_reason;
						}
					}
					emitter.emit('error', errMsg,"", newUrl, node);
				} 
			} catch(e) {
				emitter.emit('error', e.message, "", newUrl, node);
			}
		}).on('error', function(err) {
			emitter.emit("error", errMsg, "", newUrl, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}
}

function toTimeZone(time, format, zone) {
	return moment(time).tz(zone).format(format);
}

function setCustomer(dataArr, node) {
	try {
		var obj, resObj;
		var resArr = [];
		for(var i = 0; i < dataArr.length; i++) {
			resObj = {};
			obj = dataArr[i];
			resObj.id = obj.id;
			resObj.firstName = obj.first_name;
			resObj.lastName = obj.last_name;
			resObj.email = obj.email;
			resObj.createdAt = obj.date_created;
			resObj.updatedAt = obj.date_modified;
			resObj.defaultAddress = obj.addresses.url;
			resObj.slackFlag = false;
			if(actionName == 'slack' && i == 0) {
				resObj.slackFlag = true;
			}
			resObj.isLast = false;
			var length = finalDataArr.length + i;
			if(length == count-1) {
				resObj.isLast = true;
			}
			resArr[i] = resObj;	
		}
		getAddress(resArr, node);
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}
}

function getAddress(resArr, node) {
	try {
		var args = {
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(userName + ":" + apiToken),
				"Content-Type": 'application/json',
				Accept : "application/json"
			}
		};
		var customers = resArr;
		var customersLength = resArr.length;
		customers.forEach(function(customer) {
			var addressUrl = customer.defaultAddress;
			client.get(addressUrl, args, function(data, res) {
				try {
					customersLength--;
					var statusCode = parseInt(res.statusCode/100);
					if(statusCode == 2) {							
						if(res.statusCode == 204) {
							customer.defaultAddress = {};
							emitter.emit('error', 'Customer with email address ' + customer.email + ' does not have address', '', addressUrl, node);
						} else {
							var address = {};
							address.name = data[0].first_name + ' ' + data[0].last_name;
							address.street = data[0].street_1;
							address.city = data[0].city;
							address.state = data[0].state;
							address.country = data[0].country;
							address.countryCode = data[0].country_iso2;
							address.zip = data[0].zip;
							address.phone = data[0].phone;
							address.company = data[0].company;
							customer.defaultAddress = address;
						}
					} else {
						if(statusCode == 5) {
							emitter.emit('error', 'Server Error in Bigcommerce', '', addressUrl, node);
						}
						if(data[0].hasOwnProperty('message')) {
							errMsg = data[0].message;
						}
						if(data[0].hasOwnProperty('details')) {
							if(data[0].details.hasOwnProperty('invalid_reason')) {
								errMsg += ' ' + data[0].details.invalid_reason;
							}
						}
						emitter.emit('error', errMsg,"", addressUrl, node);
					}
					if(customersLength == 0) {
						finalDataArr = finalDataArr.concat(resArr);
						if(finalDataArr.length != count) {
							page++;
							getDataCount(node);
						} else {
							post(finalDataArr, node, "");
						}
					}
				} catch(e) {
					emitter.emit('error', e.message, "", addressUrl, node);
				}
			}).on('error', function(err) {
				emitter.emit("error", errMsg, "", addressUrl, node);
			});
		});
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}	
}

function setProduct(dataArr, node) {
	try {
		var obj, resObj;
		var resArr = [];
		for(var i = 0; i < dataArr.length; i++) {
			resObj = {};
			obj = dataArr[i];
			var quantity = 1;
			if(obj.hasOwnProperty("quantity")) {
				resObj.quantity = quantity;
			}
			resObj.id = obj.id;
			resObj.name = obj.name;
			resObj.type = obj.type;
			resObj.price = obj.price;
			resObj.createdAt = obj.date_created;
			resObj.updatedAt = obj.date_modified;
			resObj.description = resObj.description;
			resObj.quantity = quantity;
			resObj.sku = obj.sku;
			resObj.slackFlag = false;
			if(actionName == 'slack' && i == 0) {
				resObj.slackFlag = true;
			}
			resObj.isLast = false;
			if(i == dataArr.length-1) {
				resObj.isLast = true;
			}
			resArr[i] = resObj;
		}
		post(resArr, node, "");
		finalDataArr = finalDataArr.concat(resArr);
		if(finalDataArr.length != count) {
			page++;
			getDataCount(node);
		}
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}
}

function setOrder(dataArr, node) {
	try {
		var obj, resObj;
		var resArr = [];
		for(var i = 0; i < dataArr.length; i++) {
			resObj = {};
			obj = dataArr[i];
			resObj.id = obj.id;
			resObj.name = obj.id;
			resObj.status = obj.status;
			resObj.email = obj.billing_address.email;
			resObj.price = obj.total_ex_tax;
			resObj.shippingAmount = obj.base_shipping_cost;
			resObj.createdAt = obj.date_created;
			resObj.updatedAt = obj.date_modified;
			resObj.quantity = obj.items_total;
			resObj.paymentMethod = obj.payment_method;
			resObj.customerId = obj.customer_id;
			resObj.items = obj.products.url;
			var billingAddress = {};
			billingAddress.name = obj.billing_address.first_name + ' ' + obj.billing_address.last_name;
			billingAddress.street = obj.billing_address.street_1;
			billingAddress.city = obj.billing_address.city;
			billingAddress.state = obj.billing_address.state;
			billingAddress.country = obj.billing_address.country;
			billingAddress.countryCode = obj.billing_address.country_iso2;
			billingAddress.zip = obj.billing_address.zip;
			billingAddress.phone = obj.billing_address.phone;
			billingAddress.company = obj.billing_address.company;
			resObj.billingAddress = billingAddress;
			resObj.shippingAddress = obj.shipping_addresses.url;
			resObj.slackFlag = false;
			if(actionName == 'slack' && i == 0) {
				resObj.slackFlag = true;
			}
			resObj.isLast = false;
			if(i == dataArr.length-1) {
				resObj.isLast = true;
			}
			resArr[i] = resObj;	
		}
		getShippingAddress(resArr, node)
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}
}

function getShippingAddress(orders, node) {
	try {
		var args = {
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(userName + ":" + apiToken),
				"Content-Type": 'application/json',
				Accept : "application/json"
			}
		};
		var length = orders.length;
		orders.forEach(function(order) {
			var addressUrl = order.shippingAddress;
			try {
				client.get(addressUrl, args, function(data, res) {
					try {
						var statusCode = parseInt(res.statusCode/100);
						if(statusCode == 2) {
							var address={};
							address.name = data[0].first_name+' '+data[0].last_name;
							address.street = data[0].street_1;
							address.city = data[0].city;
							address.state = data[0].state;
							address.country = data[0].country;
							address.countryCode = data[0].country_iso2;
							address.zip = data[0].zip;
							address.phone = data[0].phone;
							address.company = data[0].company;
							order.shippingAddress = address;
							order.shippingMethod = data[0].shipping_method
							length--;
							if(length == 0) {
								getProducts(orders, node);
							}
						} else {
							if(statusCode == 5) {
								emitter.emit('error', 'Server Error in Bigcommerce', '', addressUrl, node);
							}
							if(data[0].hasOwnProperty('message')) {
								errMsg = data[0].message;
							}
							if(data[0].hasOwnProperty('details')) {
								if(data[0].details.hasOwnProperty('invalid_reason')) {
									errMsg += ' ' + data[0].details.invalid_reason;
								}
							}
							emitter.emit('error', errMsg, "", addressUrl, node);
						} 
					} catch(e) {
						emitter.emit('error', e.message, "", addressUrl, node);
					}
				}).on('error', function(err) {
					emitter.emit("error", errMsg, "", addressUrl, node);
				});
			} catch(e) {
				emitter.emit('error', e.message, "", "", node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}
}

function getProducts(orders, node) {
	try { 
		var args = {
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(userName + ":" + apiToken),
				"Content-Type": 'application/json',
				Accept : "application/json"
			}
		};
		var length = orders.length;
		orders.forEach(function(order) {
			var productUrl = order.items;
			try {
				client.get(productUrl, args, function(data, res) {
					try {
						var statusCode = parseInt(res.statusCode/100);
						if(statusCode == 2) {
							var products = [];
							for(var i = 0; i < data.length; i++) {
								var obj = {};
								var quantity = 1;
								obj.id = data[i].product_id;
								obj.name = data[i].name;
								obj.price = data[i].base_price;
								if(obj.hasOwnProperty("quantity")) {
									quantity = quantity;
								}
								obj.quantity = quantity;
								products.push(obj);
							}
							order.items = products;
							length--;
							if(length == 0) {
								post(orders, node, "");
							}
						} else {
							if(statusCode == 5) {
								emitter.emit('error', 'Server Error in Bigcommerce', '', productUrl, node);
							}
							if(data[0].hasOwnProperty('message')) {
								errMsg = data[0].message;
							}
							if(data[0].hasOwnProperty('details')) {
								if(data[0].details.hasOwnProperty('invalid_reason')) {
									errMsg += ' ' + data[0].details.invalid_reason;
								}
							}
							emitter.emit('error', errMsg, "", productUrl, node);
						} 
					} catch(e) {
						emitter.emit('error', e.message, "", productUrl, node);
					}
				}).on('error', function(err) {
					emitter.emit("error", errMsg, "", productUrl, node);
				});
			} catch(e) {
				emitter.emit('error', e.message, "", "", node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
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
		url += "/customers.json";
		var args = {
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(userName + ":" + apiToken),
				"Content-Type" : 'application/json',
				Accept : "application/json"
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
				emitter.emit('print', result);
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
		url = credentials.url;
		userName = credentials.userName;
		apiToken = credentials.apiToken;
		testApp(callback);
	} catch(e) {
		callback({status : "error", response : e.stack});
	}
}

function init(node) {
	try {
		var credentials = node.credentials;
		url = credentials.url;
		userName = credentials.userName;
		apiToken = credentials.apiToken;
		run(node);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

var Bigcommerce = {
	init : init,
	test : test
};

module.exports = Bigcommerce;