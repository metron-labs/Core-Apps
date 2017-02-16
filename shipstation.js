var Client = require('node-rest-client').Client;
var client = new Client();
var moment = require('moment-timezone');
var usStates = require('./json/us_states');
var writeFile = require('write');

var emitter = require('../core-integration-server-v2/javascripts/emitter');

var url, storeId, apiKey, password, actionName, shipDate, fromName, fromCompany, fromStreet, 
  fromCity, fromState, fromZip, fromCountryCode, fromPhone, fromResidential;

var netQuantity = 0, finalDataArr = [], length, totalCount, page = 1, count;
var errMsg = '"Connection timeout error" in Shipstation';

function run(node) {
	try {
		var nodeType = node.connector.type;
		var type = node.option.toLowerCase();
		var action = node.optionType.toLowerCase();
		if(nodeType == 'trigger') {
			if(type == 'shipping label') {
				getCoreCacheData(node);
			} else {
				getOrders(node);
			}			
		} else {
			postStoreData(node);
		}
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
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
					if(i == data.length-1) {
						node.resData = resArr;
						emitter.emit('success', node, '');
					}
				}				
			} catch(e) {
				emitter.emit('error', e.message, e.stack, "", node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function getOrders(node) {
	try {
		var reqObj = node.reqData;
		var filterDate = null;
		var newUrl = "https://ssapi.shipstation.com/orders?storeId="
			+ storeId + "&page=" + page + "&pageSize=100";
		if(node.optionType.toLowerCase() == 'new') {
			var pathStartTime = node.connection.startedAt;
			var arr = pathStartTime.split('/');
			var formattedDateStr = arr[1] + '/' + arr[0] + '/' + arr[2];
			var startDate = new Date(formattedDateStr);
			filterDate = toTimeZone(startDate, "YYYY-MM-DD HH:mm:ss", "EST");
		}
		if(filterDate != null) {
			newUrl = "https://ssapi.shipstation.com/orders?createDateStart=" + filterDate;
		}
		var args = {
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + password),
				Accept : "application/json"
			}
		};
		client.get(newUrl, args, function(data, res) {
				try {
					var statusCode = parseInt(res.statusCode/100);
					if(statusCode == 2) {
						count = data.pages;
						totalCount = data.total;
						setOrders(node, newUrl, count, totalCount, data.orders);
					} else {
						if(data.hasOwnProperty("errors")) {
							errMsg = data.errors;
						}
						emitter.emit('error', errMsg, "", newUrl, node);
					} 
				} catch(e) {
					emitter.emit('error', e.message, "", "", node);
				}
		}).on('error', function(err) {
			emitter.emit("error", errMsg, "", newUrl, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}
}

function setOrders(node, newUrl, count, totalCount, ordersArr) {
	try {
		var actionName = node.connection.actionName.toLowerCase();
		if(ordersArr.length == 0) {
			console.log("No orders Found in Shipstation");
		}
		var resArr = [];
		var resObj, obj;
		for(var i = 0; i < ordersArr.length; i++) {
			obj = ordersArr[i];
			resObj = {};
			resObj.id = obj.orderId;
			resObj.orderNo = obj.orderKey;
			resObj.email = obj.customerEmail;
			resObj.price = obj.orderTotal;
			resObj.shippingAmount = obj.shippingAmount;
			resObj.status = obj.orderStatus;
			resObj.name = obj.orderId;
			var billingAddress = {};
			var billingObj = obj.billTo;
			billingAddress.name = billingObj.name;
			billingAddress.company = billingObj.company;
			billingAddress.street = billingObj.street1;
			billingAddress.city = billingObj.city;
			billingAddress.country = billingObj.country;
			billingAddress.zip = billingObj.postalCode;
			billingAddress.phone = billingObj.phone;
			billingAddress.state = billingObj.state;
			billingAddress.countryCode = billingObj.country;
			resObj.billingAddress = billingAddress;
			var shippingAddress = {};
			var shippingObj = obj.shipTo;
			shippingAddress.name = shippingObj.name;
			shippingAddress.company = shippingObj.company;
			shippingAddress.street = shippingObj.street1;
			shippingAddress.city = shippingObj.city;
			shippingAddress.country = shippingObj.country;
			shippingAddress.zip = shippingObj.postalCode;
			shippingAddress.phone = shippingObj.phone;
			shippingAddress.state = shippingObj.state;
			shippingAddress.countryCode = shippingObj.country;
			resObj.shippingAddress = shippingAddress;
			resObj.customerId = obj.customerId;
			resObj.createdAt = obj.createDate;
			resObj.updatedAt = obj.modifyDate;
			var itemArr = obj.items;
			var items = [];
			var item, itemObj;
			for(var j = 0; j < itemArr.length; j++) {
				item = {};
				itemObj = itemArr[j];
				item.id = itemObj.productId;
				item.name = itemObj.name;
				item.price = itemObj.unitPrice;
				item.quantity = itemObj.quantity;
				items[j] = item;
			}
			resObj.items = items;
			resObj.quantity = items;
			resObj.slackFlag = false;
			if(actionName == 'slack' && i == 0) {
				resObj.slackFlag = true;
			}
			resObj.isLast = false;
			var length = finalDataArr.length + i;
			if(length == totalCount-1) {
				resObj.isLast = true;
			}
			resArr[i] = resObj;
		}
		post(resArr, node, "");
		finalDataArr = finalDataArr.concat(resArr);
		if(page != count) {
			page++;
			getOrders(node);
		}
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}
}

function postStoreData(node) {
	try {
		var action = node.optionType.toLowerCase();
		var type = node.option.toLowerCase();
		createOrder(node, type, action);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function createOrder(node, type, action) {
	try {
		var newUrl = "https://ssapi.shipstation.com/orders/createorder";
		var reqObj = node.reqData;
		var status;
		if(reqObj.status == 'Pending' || reqObj.status == 'Awaiting Payment') {
			status = 'awaiting_payment';
		} else if(reqObj.status == 'Awaiting Fulfillment' || reqObj.status == 'paid' ||
			reqObj.status == 'Awaiting Shipment' || reqObj.status == 'Awaiting Pickup' || reqObj.status == 'Paid') {
			status = 'awaiting_shipment';
		} else if(reqObj.status == 'Partially Shipped' || reqObj.status == 'Compeleted' || reqObj.status == 'Shipped') {
			status ='shipped';
		} else if(reqObj.status == 'Cancelled' || reqObj.status == 'Declined' || reqObj.status == 'Disputed' || reqObj.status == 'Refunded' 
			|| reqObj.status == 'Manual Verification Required') {
			status ='cancelled';
		}
		var billingCompany, shippingCompany;
		if(reqObj.billingAddress.hasOwnProperty('company')) {
			billingCompany = reqObj.billingAddress.company;
		}
		if(reqObj.shippingAddress.hasOwnProperty('company')) {
			shippingCompany = reqObj.shippingAddress.company;
		}		
		var items = reqObj.items;
		var itemsArr = [];		
		items.forEach(function(item) {
			var productItems = {};
			productItems.sku = reqObj.id;
			productItems.name = item.name;
			productItems.quantity = item.quantity;
			netQuantity += item.quantity;
			productItems.unitPrice = item.price;
			itemsArr.push(productItems);
		});
		var cDate = reqObj.createdAt;
		var arr = cDate.split('/');
		var formattedDateStr = arr[1] + '/' + arr[0] + '/' + arr[2];
		var country = reqObj.shippingAddress.country;
		if(country.length > 3) {
			if(country.toLowerCase() == "united states") {
				country = "US";
			} else {
				country = country.substring(0,2).toUpperCase();
			}
		}
		var postData = {
			orderNumber : reqObj.id,
			orderDate : toTimeZone(new Date(formattedDateStr), "YYYY-MM-DD HH:mm:ss", "EST"),
			orderStatus : status,
			customerEmail : reqObj.email,
			billTo : {
				name : fromName,
				company : fromCompany,
				street1 : fromStreet,
				city : fromCity,
				state : fromState,
				postalCode : fromZip,
				country : fromCountryCode,
				phone : fromPhone,
				residential : fromResidential
			},
			shipTo : {
				name : reqObj.shippingAddress.name,
				company : shippingCompany,
				street1 : reqObj.shippingAddress.street,
				city : reqObj.shippingAddress.city,
				state : reqObj.shippingAddress.state,
				postalCode : reqObj.shippingAddress.zip,
				country : country,
				phone : reqObj.shippingAddress.phone
			},
			advancedOptions : {
				storeId : storeId
			},
			shippingAmount : reqObj.shippingAmount ,
			items:itemsArr
		};
		var args = {
			data : postData,
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + password),
				Accept : "application/json",
				'Content-Type' : "application/json"
			}
		};
		client.post(newUrl, args, function(data, res) {
			try {
				var statusCode = parseInt(res.statusCode/100);
				if(statusCode == 2) {
					if(type == 'order' && action == 'create') {
						msg = "Order for " + reqObj.id + " created successfully in Shipstation.";
						post(data, node, msg);
					} else if(type == 'order' && action == 'update') {
						updateOrder(node, data);
					} else {
						createShippingLabel(node, data);
					}
				} else {
					if(data.hasOwnProperty("errors")) {
						errMsg = data.errors;
					}
					if(data.hasOwnProperty('Message')) {
						errMsg = data.Message;
					}
					if(data.hasOwnProperty('ExceptionMessage')) {
						errMsg = data.ExceptionMessage;
					}
					emitter.emit('error', errMsg, data, newUrl, node);
				} 
			} catch(e) {
				emitter.emit('error', e.message, "", "", node);
			}
		}).on('error', function(err) {
			emitter.emit("error", errMsg, "", newUrl, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}
}

function updateOrder(node, data) {
	try {
		var newUrl = "https://ssapi.shipstation.com/orders/createorder";
		var reqObj = node.reqData;
		var status;
		if(reqObj.status == 'Pending' || reqObj.status == 'Awaiting Payment') {
			status = 'awaiting_payment';
		} else if(reqObj.status == 'Awaiting Fulfillment' || reqObj.status == 'paid' ||
			reqObj.status == 'Awaiting Shipment' || reqObj.status == 'Awaiting Pickup' || reqObj.status == 'Paid') {
			status ='awaiting_shipment';
		} else if(reqObj.status == 'Partially Shipped' || reqObj.status == 'Compeleted' || reqObj.status == 'Shipped') {
			status = 'shipped';
		} else if( reqObj.status == 'Cancelled' || reqObj.status == 'Declined' || reqObj.status == 'Disputed' || reqObj.status == 'Refunded' 
			|| reqObj.status == 'Manual Verification Required' ) {
			status = 'cancelled';
		}
		var billingAddress = {};
		billingAddress.name = fromName;
		billingAddress.street1 = fromStreet;
		billingAddress.city = fromCity;
		billingAddress.state = fromState;
		billingAddress.postalCode = fromZip;
		billingAddress.country = fromCountryCode;
		billingAddress.phone = fromPhone;
		billingAddress.residential = fromResidential;
		var shippingAddress = {};
		shippingAddress.name = reqObj.shippingAddress.name;
		shippingAddress.street1 = reqObj.shippingAddress.street;
		shippingAddress.city = reqObj.shippingAddress.city;
		shippingAddress.state = reqObj.shippingAddress.state;
		shippingAddress.postalCode = reqObj.shippingAddress.zip;
		shippingAddress.country = country,
		shippingAddress.phone = reqObj.shippingAddress.phone;
		var items = reqObj.items;
		var itemsArr = [];
		items.forEach(function(item) {
			var productItems = {};
			productItems.sku = reqObj.id;
			productItems.name = item.name;
			productItems.quantity = item.quantity;
			productItems.unitPrice = item.price;
			itemsArr.push(productItems);
		});
		var postData = {
			orderNumber : reqObj.id,
			orderKey : reqObj.orderNo,
			orderDate : reqObj.createdAt,
			orderStatus : reqObj.status,
			billTo : billingAddress,
			shipTo : shippingAddress,
			advancedOptions : {
				storeId : storeId
			},
			shippingAmount : reqObj.shippingAmount ,
			items : itemsArr
		};
		var args = {
			data : postData,
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + password),
				Accept : "application/json",
				'Content-Type' : "application/json"
			}
		};
		client.post(newUrl, args, function(data, res) {
				try {
					var statusCode = parseInt(res.statusCode/100);
					if(statusCode == 2) {
						msg = "Order for " + data.orderKey + " updated successfully in Shipstation.";
						post(data, node, msg);
					} else {
						if(data.hasOwnProperty("errors")) {
							errMsg = data.errors;
						}
						emitter.emit('error', errMsg, data, newUrl, node);
					}
				} catch(e) {
					emitter.emit('error', e.message, "", "", node);
				}
			} catch(e) {
				emitter.emit('error', e.message, "", "", node);
			}
		}).on('error', function(err) {
			emitter.emit("error", errMsg, "", newUrl, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}
}

function createShippingLabel (node, data) {
	try {
		var obj = node.reqData;
		console.log('obj................%j',obj);
		var newUrl = "https://ssapi.shipstation.com/shipments/createlabel";
		getCarrierCode(node, function(carrierCode) {
			serviceCode(node, carrierCode, function(serviceCode) {
				listPackage(node, carrierCode, function(packages) {
					var cDate = new Date(shipDate);
					var postData = {
						carrierCode : carrierCode.code,
						serviceCode : serviceCode,
						packageCode : packages,
						confirmation : data.confirmation,
						shipDate : toTimeZone(new Date(cDate), "YYYY-MM-DD", "EST"),
						weight : {
							value : netQuantity,
							units : data.weight.units
						},
						dimensions : data.dimensions,
						shipFrom : {
							name : fromName,
							company : fromCompany,
							street1 : fromStreet,
							city : fromCity,
							state : fromState,
							postalCode : fromZip,
							country : fromCountryCode,
							phone : fromPhone,
							residential : fromResidential
						},
						shipTo : {
							name : obj.shippingAddress.name,
							company : obj.shippingAddress.company,
							street1 : obj.shippingAddress.street,
							city : obj.shippingAddress.city,
							state : obj.shippingAddress.state,
							postalCode : obj.shippingAddress.zip,
							country : obj.shippingAddress.countryCode,
							phone : obj.shippingAddress.phone
						},
						insuranceOptions : data.insuranceOptions,
						internationalOptions : {
							contents : "merchandise",
							customsItems : [
								{
								customsItemId : data.items.orderItemId,
								description : data.items.name,
								quantity : data.items.quantity,
								value : 1,
								harmonizedTariffCode : null,
								countryOfOrigin : fromCountryCode
								}
							],
							nonDelivery : "return_to_sender"
						},
						advancedOptions : data.advancedOptions,
						testLabel : true
					}

					var args = {
						data : postData,
						headers : {
							Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + password),
							Accept : "application/json", "Content-Type" : "application/json"
						}
					};
					client.post(newUrl, args, function(data, res) {
						try {
							var statusCode = parseInt(res.statusCode/100);
							if(statusCode == 2) {
								convertPdf(data.labelData, res, node);								
							} else {
								if(data.hasOwnProperty("errors")) {
									errMsg = data.errors;
								}
								if(data.hasOwnProperty('Message')) {
									errMsg = data.Message;
								}
								if(data.hasOwnProperty('ExceptionMessage')) {
									errMsg = data.ExceptionMessage;
								}
								emitter.emit('error', errMsg, data, newUrl, node);
							} 
						} catch(e) {
							emitter.emit('error', e.message, "", "", node);
						}           
					}).on('error', function(err) {
						emitter.emit("error", errMsg, "", newUrl, node);
					});
				});
			});
		});
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}
}

function listCarriers(node, callback) {
	try {
		var url = "https://ssapi.shipstation.com/carriers";
		var args = {
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + password),
				Accept : "application/json"
			}
		};
		client.get(url, args, function(data, res) {
				try {
					var statusCode = parseInt(res.statusCode/100);
					if(statusCode == 2) {
						callback(data);
					} else {	
						emitter.emit('error', errMsg, "", url, node);
					} 
				} catch(e) {
					emitter.emit('error', e.message, "", "", node);
				}
		}).on('error', function(err) {
			emitter.emit("error", errMsg, "", url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}
}

function getCarrierCode(node, callback) {
	try {
		listCarriers(node, function(carrierCode) {
				var newUrl = "https://ssapi.shipstation.com/carriers/getcarrier?carrierCode=" + carrierCode[0].code;
				var args = {
					headers : {
						Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + password),
						Accept : "application/json"
					}
				};
				client.get(newUrl, args, function(data, res) {
						try {
							var statusCode = parseInt(res.statusCode/100);
							if(statusCode == 2) {
								callback(data)
							} else {	
								emitter.emit('error', errMsg, "", url, node);
							} 
						} catch(e) {
							emitter.emit('error', e.message, "", "", node);
						}
				}).on('error', function(err) {
					emitter.emit("error", errMsg, "", url, node);
				});
		});
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}
}

function serviceCode(node, carrierCode, callback) {
	try {
		var newUrl = "https://ssapi.shipstation.com/carriers/listservices?carrierCode=" + carrierCode.code;
			var args = {
				headers : {
					Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + password),
					Accept : "application/json"
				}
			};
		client.get(newUrl, args, function(data, res) {
				try {
					var statusCode = parseInt(res.statusCode/100);
					if(statusCode == 2) {
						callback(data[0].code);
					} else {	
						emitter.emit('error', errMsg, "", url, node);
					} 
				} catch(e) {
					emitter.emit('error', e.message, "", "", node);
				}
		}).on('error', function(err) {
			emitter.emit("error", errMsg, "", url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}
}

function listPackage(node, carrierCode, callback) {
	try {
		var newUrl = "https://ssapi.shipstation.com/carriers/listpackages?carrierCode=" + carrierCode.code;
		var args = {							
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + password),
				Accept : "application/json"
			}
		};
		client.get(newUrl, args, function(data, res) {
				try {
					var statusCode = parseInt(res.statusCode/100);
					if(statusCode == 2) {
						callback(data[0].code);
					} else {	
						emitter.emit('error', errMsg, "", url, node);
					} 
				} catch(e) {
					emitter.emit('error', e.message, "", "", node);
				}
		}).on('error', function(err) {
			emitter.emit("error", errMsg, "", url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}
}

function b64EncodeUnicode(str) {
    return new Buffer(str).toString('base64');
}

function toTimeZone(time, format, zone) {
	return moment(time).tz(zone).format(format);
}

function post(resArr, node, message) {
	node.resData = resArr;
	emitter.emit("success", node, message);
}

String.prototype.findCode = function (s) {
	var str = this.toLowerCase();
	s = s.toLowerCase();
	if(str.indexOf(s) == -1) {
		return false;
	}
	return true;
};

function getUSProvinceCode(usstate) {
	for(key in usStates) {
		if(key.findCode(usstate)) {
			return usStates[key];
		}
	}	
}

function convertPdf(data, res, node) {
	try {
		var reqObj = node.reqData;
		var pdfData =  'data:application/pdf;base64,'+ new Buffer(data);
		var buf = decodeBase64(pdfData);
		var ext = pdfData.split(';')[0].match(/jpeg|png|gif|pdf/)[0];
		var file = writeFile.stream('./shipstation/label/' + reqObj.id + '.' + ext);
		file.write(buf.data);
		file.end();
		file.on('finish' , function() {
			var msg = "Shipping label created successfully in Shipstation.";
			reqObj.id = reqObj.id.toString();
			reqObj.fileType = res.headers["content-type"];
			reqObj.fileName = reqObj.id + '.' + ext;
			reqObj.fileUrl = './shipstation/label/' + reqObj.id + '.' + ext;
			node.dataObj = reqObj;
			emitter.emit('save-to-core', node, msg);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function decodeBase64(dataString) {
	var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
	var response = {};
	if (matches.length == 3) {
		response.type = matches[1];
		response.data = new Buffer(matches[2], 'base64');
		return response;
	}
}

function testApp(callback) {
	try {
		url = "https://ssapi.shipstation.com/stores/" + storeId;
		var args = {
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + password),
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
		})
	} catch(e) {
		callback({status:'error', response:e.stack});
	}
}

function test(request, callback) {
	try {
		var credentials = request.credentials;
		storeId = credentials.storeId;
		apiKey = credentials.apiKey;
		password = credentials.password;
		testApp(callback);
	} catch(e) {
		callback({status:"error", response:e.stack});
	}
}

function init(node) {
	try {
		var credentials = node.credentials;
		storeId = credentials.storeId;
		apiKey = credentials.apiKey;
		password = credentials.password;
		if(node.connector.type.toLowerCase() == 'action') {
			shipDate = credentials.shipDate;
			fromName = credentials.fromName;
			fromCompany = credentials.fromCompany;
			fromStreet1 = credentials.fromStreet;
			fromCity = credentials.fromCity;
			var state = credentials.fromState;
			fromZip = credentials.fromZip;
			fromCountryCode = credentials.fromCountryCode;
			fromPhone = credentials.fromPhone;
			fromResidential = credentials.fromResidential;
			if(state.length > 2) {
				if(fromCountryCode.toUpperCase() == "US") {
					state = getUSProvinceCode(state);
				} else {
					state = state.substring(0,2).toUpperCase();
				}
			}
			fromState = state;
		}
		run(node);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

var Shipstation = {
	init : init,
	test : test
};

module.exports = Shipstation;