var Client = require('node-rest-client').Client;
var async = require('async');
var usStates = require('../us_states');
var client = new Client();

var shippoToken = '';
var  fromName, fromPhone, fromCompany, fromStreet, fromCity, fromState, fromCountry, fromCountryCode, fromZip;
var resArr = [];
var arrayLength = 0;
var finalDataArr = [];

function getStoreData(url, args, type, node) {
	client.get(url,args,function(data,res) {
		var dataLength = data.count;
		arrayLength += data.results.length;
		var results = data.results;
		finalDataArr = finalDataArr.concat(results);
		if(dataLength == arrayLength) {
			if(type.toLowerCase() == "order") {
				formOrder(finalDataArr, args, node);
			} else {
				formTransaction(finalDataArr, args, node);
			}
		} else {
			var newUrl = data.next;
			getStoreData(newUrl,args,type,node);
		}		
	}).on('error', function(err){
		console.log("Smoething went wrong on the request",err.request.options);
	});

}

function formOrder(dataArr, args, node){
	console.log('response : %j',dataArr);
	var obj,resObj;
	var resArr = [];
	for(var i = 0; i < dataArr.length; i++) {
		resObj = {};
		obj = dataArr[i];
		resObj.id = obj.object_id;
		resObj.name = obj.order_number;
		resObj.status = obj.order_status;
		resObj.createdAt = obj.created_at;
		resObj.price = obj.total_price;
		resObj.email = obj.address_from.email;
		var billAddr = {};
		billAddr.name = obj.address_from.name;		
		billAddr.company = obj.address_from.company;
		billAddr.phone = obj.address_from.phone;
		billAddr.street = obj.address_from.street1;
		billAddr.city = obj.address_from.city;
		billAddr.state = obj.address_from.state;
		billAddr.country = obj.address_from.country;
		billAddr.zip = obj.address_from.zip;
		resObj.billingAddress = billAddr;
		var shipAddr = {};
		shipAddr.name = obj.to_address.name;
		shipAddr.company = obj.to_address.company;
		shipAddr.phone = obj.to_address.phone;
		shipAddr.street = obj.to_address.street1;
		shipAddr.city = obj.to_address.city;
		shipAddr.state = obj.to_address.state;
		shipAddr.country = obj.to_address.country;
		shipAddr.zip = obj.to_address.zip;
		resObj.shippingAddress = shipAddr;
		var items = [];
		var itemArr = obj.items;
		if(itemArr.length != 0) {
			var item,itemObj;
			var sku = '';
			for(var j = 0; j < itemArr.length; j++) {
				item = {};
				itemObj = itemArr[j];
				item.id = itemObj.id;
				item.name = itemObj.title;
				item.price = itemObj.price;
				item.quantity = itemObj.quantity;
				if(itemObj.hasOwnProperty('sku')) {
					sku = itemObj.sku;
				}
				item.sku = sku;
				items[j] = item;
			}
		}
		resObj.items = items;
		resObj.transactionsId = '';
		resObj.trackingNo = '';
		resObj.shippingAmount = '';
		resObj.updatedAt = '';
		resObj.rateId = '';
		if(obj.hasOwnProperty("transactions") && obj.transactions.length != 0){
			var transObj;
			transObj = obj.transactions[0];
			resObj.transactionsId = transObj.object_id;
		}
		resArr[i] = resObj;	
	} 
	getOrderTransactions(resArr, args, node);
}

function getOrderTransactions(resArr, args, node) {
	var obj, resObj,transUrl = '';
	var length = resArr.length;
	async.forEach(resArr,function(resObj){
		if(resObj.transactionsId == '') {
			length--;
			if(length == 0) {
				getOrderRates(resArr, args, node);
			}
		} else {			
			transUrl = "https://api.goshippo.com/v1/transactions/" + resObj.transactionsId;
			client.get(transUrl, args, function(data, res) { 
				resObj.trackingNo = data.tracking_number;
				resObj.updatedAt = data.object_updated;
				var rateId = data.rate;
				resObj.rateId = rateId;
				length--;
				if(length == 0) {
					getOrderRates(resArr, args, node);
				}														
			}).on('error', function(err){
				console.log('Something went wrong on the request',err.request.options);
			});
	}}, function(error) {
		console.log("%j",error);
	});			
}

function getOrderRates(resArr, args, node) {
	var length = resArr.length;
	async.forEach(resArr,function(resObj){
		if(resObj.rateId == ''){
			length--;
			if(length == 0) {
				post(resArr, node);
			}
		} else {			
			var rateUrl = "https://api.goshippo.com/v1/rates/" + resObj.rateId;
			client.get(rateUrl, args, function(data, res) {
				var amount = data.amount;
				var margin = amount * 0.15;
				shippingCost = +amount + +margin;
				resObj.shippingAmount = shippingCost;
				length--;
				if(length == 0) {
					post(resArr, node);
				}
			}).on('error', function(err) {
				console.log('Something went wrong on the request', err.request.options);
			});
	}}, function(error){
		console.log(error);
	});
}

function formTransaction(dataArr, args,node) {
	var obj,resObj;
	var resArr = [];
	
	for(var i = 0; i < dataArr.length;i++) {		
		resObj = {};
		obj = dataArr[i];
		resObj.id = obj.object_id;
		resObj.name = obj.object_id;
		resObj.email = obj.object_owner;
		var status = "UNKNOWN";
		var errSubject = "Shippo Transaction : " + obj.object_id;
		var errMsg  = '';
		if(obj.tracking_status != null) {
			status = obj.tracking_status.status;
			errMsg = obj.tracking_status.status_details;
		}
		resObj.status = status;
		if(obj.messages.length > 0) {
			errMsg = obj.messages[0].text;
		} else if(errMsg == null || errMsg == ''){
			if(status.toUpperCase() == "UNKNOWN") {
				errMsg = "The package has not been found via the carrier's tracking system, "
							+ "or it has been found but not yet scanned by the carrier";
			} else if(status.toUpperCase() == "FAILURE") {
				errMsg = "The carrier indicated that there has been an issue with the delivery."
						+ " This can happen for various reasons and depends on the carrier. "
						+ "This status does not indicate a technical, but a delivery issue.";
			} else if(status.toUpperCase() == "TRANSIT") {
				errMsg = "The package has been scanned by the carrier and is in transit.";
			} else if(status.toUpperCase() == "DELIVERED") {
				errMsg = "The package has been successfully delivered.";
			} else if(status.toUpperCase() == "RETURNED") {
				errMsg = "The package is en route to be returned to the sender,"
								+ " or has been returned successfully.";
			}
		}
		resObj.errMsg = errSubject + ' ' + errMsg;
		resObj.createdAt = obj.object_created;
		resObj.updatedAt = obj.object_updated;
		resObj.rateId = obj.rate;
		resArr[i] = resObj;
	}
	getTransactionsRate(resArr, args, node);
}

function getTransactionsRate(resArr, args, node) {
	var length = resArr.length;
	
	async.forEach(resArr,function(resObj){
		if(resObj.rateId == ''){
			length--;
			if(length == 0) {
				getShipment(resArr, args, node);
			}
		} else {			
			var rateUrl = "https://api.goshippo.com/v1/rates/" + resObj.rateId;
			client.get(rateUrl, args, function(data, res) {
				resObj.shippingAmount = data.amount;
				resObj.shipmentId = data.shipment;
				length--;
				if(length == 0) {
					getShipment(resArr, args, node);
				}
			}).on('error', function(err) {
				console.log('Something went wrong on the request', err.request.options);
			});
	}}, function(error){
		console.log(error);
	});
	
}

function getShipment(resArr, args, node) {
	var length = resArr.length;
	
	async.forEach(resArr,function(resObj){
		if(resObj.shipmentId == ''){
			length--;
			if(length == 0) {
				getAddress(resArr, args, node);
			}
		} else {			
			var shipmentUrl = "https://api.goshippo.com/v1/shipments/" + resObj.shipmentId;
			client.get(shipmentUrl, args, function(data, res) {
				if(data.object_status.toUpperCase() == "ERROR" 
					|| data.object_state.toUpperCase() == "INVALID" ) {
					if(resObj.errMsg == '' && data.messages.length > 0) {
						resObj.errMsg = data.messages[0].text;
					}
				}
				resObj.declId = data.customs_declaration;
				resObj.addressId = data.address_to;
				length--;
				if(length == 0) {
					getAddress(resArr, args, node);
				}
			}).on('error', function(err) {
				console.log('Something went wrong on the request', err.request.options);
			});
	}}, function(error){
		console.log(error);
	});
	
}

function getAddress(resArr, args, node) {
	var length = resArr.length;
	
	async.forEach(resArr,function(resObj){
		if(resObj.addressId == ''){
			length--;
			if(length == 0) {
				getCustomDeclarations(resArr, args, node);
			}
		} else {			
			var addressUrl = "https://api.goshippo.com/v1/addresses/" + resObj.addressId;
			client.get(addressUrl, args, function(data, res) {
				if( data.object_state.toUpperCase() == "INVALID" ) {
					if(resObj.errMsg == '' && data.messages.length > 0) {
						resObj.errMsg = data.messages[0].text;
					}
				}
				resObj.email = data.email;
				var addr = {};
				addr.name = data.name;
				addr.phone = data.phone;
				addr.company = data.company;
				addr.street = data.street1;
				addr.city = data.city;
				addr.state = data.state;
				addr.country = data.country;
				resObj.billingAddress = addr;
				resObj.shippingAddress = addr;
				length--;
				if(length == 0) {
					getCustomDeclarations(resArr, args, node);
				}
			}).on('error', function(err) {
				console.log('Something went wrong on the request', err.request.options);
			});
	}}, function(error){
		console.log(error);
	});

}

function getCustomDeclarations(resArr, args, node) {
	var length = resArr.length;
	async.forEach(resArr, function(resObj){
		if(resObj.declId == '' || resObj.declId == null) {
			length--;	
			resObj.items = [];		
			if(length == 0) {
				post(resArr, node);
			}
		} else {			
			var declUrl = "https://api.goshippo.com/v1/customs/declarations/" + resObj.declId;
			client.get(declUrl, args, function(data, res) {
				if(data.object_state.toUpperCase() == "INVALID" ) {
					if(resObj.errMsg == '' && data.messages.length > 0) {
						resObj.errMsg = data.messages[0].text;
					}
				}
				var items = data.items;
				var products = [];
				var i = 0;
				var itemsLength = items.length;
				async.forEach(items, function(item) {
					var itemUrl = "https://api.goshippo.com/v1/customs/items/" + item;
					client.get(itemUrl, args, function(data1, res1) {
						if(data.object_state.toUpperCase() == "INVALID" ) {
							if(resObj.errMsg == '' && data.messages.length > 0) {
								resObj.errMsg = data.messages[0].text;
							}
						}
						var prod = {};
						prod.name = data1.description;
						quantity = data1.quantity
						prod.quantity = data1.quantity;
						prod.price = data1.value_amount;
						resObj.currency = data1.value_currency;
						products[i] = prod;						
						i++;
						itemsLength--;
						if(itemsLength == 0) {
							resObj.items = products;
							var price = 0;
							var quantity = 0;
							var obj;
							for(var j = 0; j < products.length; j++) {
								obj = products[j];
								quantity += +obj.quantity;
								price += obj.price * obj.quantity;
							}
							resObj.price = price;
							resObj.quantity = quantity;
							length--;
						}							
						if(length == 0) {
							post(resArr, node);
						}
					}).on('error', function(err) {
						console.log('Something went wrong on the request', err.request.options);
					});
				}, function(error){
					console.log(error);
				});
			}).on('error', function(err) {
				console.log('Something went wrong on the request', err.request.options);
			});
	}}, function(error){
		console.log(error);
	});	
}

function postData(url, args,type, node) {
	var url = "https://api.goshippo.com/v1/";
	postOrder(url, type, node);	
}

function postOrder(url, type, node) {
	var newUrl = url + "orders";
	var postArr = node.resData;
	var resArr = [];	
	var items = [];
	var obj, itemObj, item, postData, country;
	for(var i = 0; i < postArr.length; i++) {
		obj = postArr[i];
		for(var j = 0; j < obj.items.length; j++) {
			var currency = "USPS";
			item = {};
			itemObj = obj.items[j];
			item.title = itemObj.name;
			item.quantity = itemObj.quantity;
			item.price = itemObj.price;
			item.sku = itemObj.sku;
			if(itemObj.hasOwnProperty("currency")) {
				currency = itemObj.currency;
			}
			item.currency = currency;
			items[j] = item;
		}
		country = obj.shippingAddress.country.trim();
		if(country.length > 3) {
			country = "US";
		}
		postData = {
			order_number : obj.id,
			total_price : obj.price,
			address_from : {
				object_purpose : "PURCHASE",
				name : fromName,
				company : fromCompany,
				street1 : fromStreet,
				city : fromCity,
				state : fromState,
				country : fromCountryCode,
				zip : fromZip,
				phone : fromPhone,
				email : obj.email,
				metadata : 'Order ID ' + obj.id,
				validate : true
			},
			to_address :{
				object_purpose : "PURCHASE",
				name : obj.shippingAddress.name,
				company : obj.shippingAddress.company,
				street1 : obj.shippingAddress.street,
				city : obj.shippingAddress.city,
				state : obj.shippingAddress.state,
				country : country,
				zip : obj.shippingAddress.zip,
				phone : obj.shippingAddress.phone,
				email : obj.email,
				metadata : 'Order ID ' + obj.id,
				validate : true
			},
			metadata : 'Order Id ' + obj.id,
			items : items
		};
		var args = {
			data : postData,
			headers : { Authorization : 'ShippoToken ' + shippoToken, Accept : "application/json", "Content-Type" : "application/json"}
		};
		client.post(newUrl, args, function(data, res) {
			resArr[i-1] = data;
			if(i == postArr.length) {
				if(type.toLowerCase() == "order") {
					post(resArr, node);
				} else {
					postShipment(url, resArr, null, "order", node);
				}
			}
		}).on('error', function(err) {
			console.log('Something went wrong on the request',err.request.options);
		});
	}
}

function postShipment(url, orderArr, transArr, tag, node) {
	var newUrl = url + "shipments";
	var dataObj, postData, obj;
	var length = width = height = weight = 0;
	for(var i = 0; i < orderArr.length; i++) {
		var returnOf = '';
		dataObj = orderArr[i];
		if( tag.toLowerCase() == "transaction") {
			obj  = transArr[i];
			returnOf = obj.object_id;
		} 		
		postData = {
			object_purpose : "PURCHASE",
			address_from : dataObj.address_from.object_id,
			address_to : dataObj.to_address.object_id,
			return_of : returnOf,
			parcel : {
				length : 6.0,
				width : 6.0,
				height : 6.0,
				weight : 1.0,
				distance_unit : "in",
				mass_unit : "lb",
				metadata : 'Order ID ' + dataObj.order_number
			},
			reference_1 : dataObj.order_number,
			reference_2 : "Order Number",
			metadata : 'Order ID ' + dataObj.order_number,
			async : false
		};
		var args = {
			data : postData,
			headers : { Authorization : 'ShippoToken ' + shippoToken, Accept : "application/json", "Content-Type" : "application/json"}
		};
		client.post(newUrl, args, function(data, res) {
			resArr[i-1] = data;
			if(i == orderArr.length) {
				postTransaction(url, orderArr, resArr, tag, node);				
			}
		}).on('error', function(err) {
			console.log('Something went wrong on the request',err.request.options);
		});
	}
}

function postTransaction(url, orderArr, shipArr, tag, node){
	var newUrl = url + "transactions";
	var labelType = node.reqData.entity.type;
	var dataObj, rateObj, obj;
	for(var i = 0; i < shipArr.length; i++){
		obj = orderArr[i];
		dataObj = shipArr[i];
		var rates = dataObj.rates_list;
		var price = obj.total_price;
		var days = 1;
		var carrier = "USPS";
		var amount = 0;
		var rate = '';
		if(price <= 100) {
			days = 3;
		} else if(price >= 100 && price <= 200) {
			days = 2;
		}
		for(var j = 0; j < rates.length; j++) {
			var rateObj = rates[j];
			if(rateObj.provider.toLowerCase() == carrier.toLowerCase()) {
				if(amount == 0 && (rateObj.days == days || (days == 3 && rateObj.days >=3))) {
					rate = rateObj.object_id;
					amount = rateObj.amount;
				}
				if(amount > rateObj.amount && (rateObj.days == days || (days == 3 && rateObj.days >=3))) {
					rate = rateObj.object_id;
					amount = rateObj.amount;
				}
			}
		}
		if(rate == '') {
			rate = rates[0].object_id;
		}
		postData = {
			order : obj.object_id,
			rate : rate
			//metadata : "Order " + obj.id
		};
		var args = {
			data : postData,
			headers : { Authorization : 'ShippoToken ' + shippoToken, Accept : "application/json", "Content-Type" : "application/json"}
		};
		client.post(newUrl, args, function(data, res) {
			resArr[i-1] = data;
			if(i == shipArr.length) {
				if(labelType.toLowerCase() == "shipping label") {
					post(resArr, node);
				} else if(labelType.toLowerCase() == "return label" && tag.toLowerCase() == "transaction") {
					post(resArr, node);
				} else {
					postShipment(url, orderArr, resArr, "transaction", node);
				}								
			}
		}).on('error', function(err) {
			console.log('Something went wrong on the request',err.request.options);
		});
	}
}

function post(resArr, node) {
	console.log("Shippo Response: %j", resArr);
	node.resData = resArr;
}

function run(node) {
	var type = node.reqData.entity.type;
	var nodeType = node.type[0];
	var url = "https://api.goshippo.com/v1/";	
	var args = {
		headers: {Authorization: "ShippoToken " + shippoToken }
	};
	if(nodeType.toLowerCase() == "trigger") {
		if(type == "order"){
			url += "orders?page=1&results=100";
		} else {
			url += "transactions?page=1&results=100";
		}
		getStoreData(url, args, type, node);
	} else {
		postData(url, args, type, node);
	}	
}

module.exports=(function(){	
	var Shippo = {
		init: function(node){
			var credentials = node.reqData.credentials;
			shippoToken = credentials[0];
			fromName = credentials[1];
			fromPhone = credentials[2];
			fromCompany = credentials[3];
			fromStreet = credentials[4];
			fromCity = credentials[5];
			var state = credentials[6].trim();
			fromCountry = credentials[7].trim();
			fromCountryCode = credentials[8];
			fromZip = credentials[9];
			distanceUnit = credentials[10];
			massUnit = credentials[11];
			if(fromCountryCode == '') {
				if(fromCountry.length > 3) {
					fromCountryCode = fromCountry.substring(0,2).toUpperCase();
				} else {
					fromCountryCode = fromCountry;
				} 			
			}
			if(state.length > 2) {
				if(fromCountryCode.toUpperCase() == "US") {
					state = usStates[state];
				} else {
					state = state.substring(0,2).toUpperCase();
				}
			}
			fromState = state;
			run(node);
		}
	};
	return Shippo;
})();
