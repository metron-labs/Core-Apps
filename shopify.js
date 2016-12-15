var Client = require('node-rest-client').Client;
var client = new Client();

//var emitter = require('../javascripts/emitter');

var apiKey,apiPassword,storeName;
var errMsg = 'Something went wrong on the request';

function getStoreData(url,args,type,node) {
	client.get(url, args, function (data, res) {
		var status = parseInt(res.statusCode/100);
		
		if( status == 2) {
			if(type.toLowerCase() == "customer") {
				if(data.customers.length == 0 ) {
					errMsg = 'No data found in Shopify';
					console.log(errMsg);
					// emitter.emit("error",errMsg,"",url,node);
				}
				formCustomer(data.customers,node);
			} else if (type.toLowerCase() == "product") {
				if(data.products.length == 0 ) {
					errMsg = 'No data found in Shopify';
					console.log(errMsg);
					// emitter.emit("error",errMsg,"",url,node);
				}
				formProduct(data.products,node);
			} else {
				if(data.orders.length == 0 ) {
					errMsg = 'No data found in Shopify';
					console.log(errMsg);
					// emitter.emit("error",errMsg,"",url,node);
				}
				formOrder(data.orders,node)
			}
		} else {
			errMsg = data.errors;
			console.log(errMsg,res.statusCode);
			// emitter.emit('error',errMsg,"", url, node);
		}		
	}).on('error',function(err){
    	console.log(errMsg, err.request.options);
    	//emitter.emit("error",'Something went wrong on the request',"", url, node);
    });
}

function b64EncodeUnicode(str) {
   	return new Buffer(str).toString('base64');
}

function formCustomer(dataArr, node) {
	var obj, resObj;
	var resArr = [];
	for(var i = 0; i < dataArr.length; i++) {
		resObj = {};
		obj = dataArr[i];
		resObj.id = obj.id;
		resObj.name = obj.name;
		resObj.email = obj.email;
		resObj.createdAt = obj.created_at;
		resObj.updatedAt = obj.updated_at;
		resObj.firstName = obj.first_name;	
		resObj.lastName = obj.last_name;	
		var addr1 = {};
		addr1.firstName = obj.default_address.first_name;	
		addr1.lastName = obj.default_address.last_name;
		addr1.street = obj.default_address.address1;
		addr1.city = obj.default_address.city;
		addr1.state = obj.default_address.province;
		addr1.stateISO2 = obj.default_address.province_code;
		addr1.country = obj.default_address.country;
		addr1.countryISO2 = obj.default_address.country_code;
		addr1.zip = obj.default_address.zip;
		addr1.phone = obj.default_address.phone;
		resObj.defaultAddress = addr1;
		resArr[i] = resObj;
		}
		post(resArr, node);
	}

function formOrder(dataArr, node) {
	var obj, resObj;
	var resArr = [];
	for(var i = 0; i < dataArr.length; i++) {
		resObj = {};
		obj = dataArr[i];
		resObj.id = obj.id;
		resObj.email = obj.email;
		resObj.createdAt = obj.created_at;
		resObj.updatedAt = obj.updated_at;
		resObj.price = obj.total_price;
		resObj.status = obj.financial_status;
		resObj.name = obj.name;
		resObj.customerId = obj.customer.id;
		resObj.customerName = obj.customer.first_name + ' ' + obj.customer.last_name;
		var billingAddress = {}
		billingAddress.name = obj.billing_address.name;
		billingAddress.street = obj.billing_address.address1;
		billingAddress.city = obj.billing_address.city;
		billingAddress.state = obj.billing_address.province;
		billingAddress.stateISO2 = obj.billing_address.province_code;
		billingAddress.country = obj.billing_address.country;
		billingAddress.countryISO2 = obj.billing_address.countryISO2;
		billingAddress.zip = obj.billing_address.zip;
		billingAddress.phone = obj.billing_address.phone;
		resObj.billingAddress = billingAddress;
		var shippingAddress = {};
		shippingAddress.name = obj.shipping_address.name;
		shippingAddress.street = obj.shipping_address.address1;
		shippingAddress.city = obj.shipping_address.city;
		shippingAddress.state = obj.shipping_address.province;
		shippingAddress.stateISO2 = obj.shipping_address.province_code;
		shippingAddress.country = obj.shipping_address.country;
		shippingAddress.countryISO2 = obj.shipping_address.countryISO2;
		shippingAddress.zip = obj.shipping_address.zip;
		shippingAddress.phone = obj.shipping_address.phone;
		resObj.shippingAddress = shippingAddress;
		resObj.shippingMethod = obj.processing_method;
		resObj.paymentMethod = obj.processing_method;
		var items = [];
		var itemObj,item;
		var quantity = 0;
		for(var j = 0; j < obj.line_items.length; j++) {
			item = {};
			itemObj = obj.line_items[j];
			item.id = itemObj.product_id;
			item.name = itemObj.name;
			item.price = itemObj.price;
			item.quantity = itemObj.quantity;
			item.sku = itemObj.sku;
			items[j] = item;
			quantity += itemObj.quantity;
		}
		resObj.items = items;
		resObj.quantity = quantity;
		resArr[i] = resObj;
	}
	post(resArr, node);
}

function formProduct(dataArr,node) {
	var obj,resObj;
	var resArr = [];
	for(var i = 0;  i < dataArr.length; i++) {
		resObj = {};
		obj = dataArr[i];
		resObj.id = obj.id;
		resObj.name = obj.title;
		resObj.createdAt = obj.created_at;
		resObj.updatedAt = obj.updated_at;
		resObj.description = obj.body_html;
		resObj.catagory = obj.product_type;
		var variants = obj.variants[0];
		resObj.sku = variants.sku;
		resObj.price = variants.price;
		resObj.qtyOnHand = variants.inventory_quantity;
		resArr[i] = resObj;
	}
	post(resArr, node);
}

function postAction(url, type, node) {
	var action = node.connection.optionType.toLowerCase();
	if(type == "customer" && action == "new") {
		postCustomer(url, node);
	} else if(type == "customer" && action == "update") {
		updateCustomer(url, node);
	} else if(type == "order" && action == "new") {
		postOrder(url, node);
	} else if(type == "order" && action == "update") {
		updateOrder(url, node);
	} else if(type == "product" && action == "new") {
		postProduct(url, node);
	} else {
		updateProduct(url, node);
	}
}

function postCustomer(url, node) {
	var obj = node.requestData;
	url += "customers.json";
	var lastName = '';
	var name, street, city, state, country, zip, phone, company;
	if(obj.hasOwnProperty("shippingAddress")) {
		name = obj.billingAddress.name;
		street = obj.billingAddress.street;
		city = obj.billingAddress.city;
		state = obj.billingAddress.state;
		country = obj.billingAddress.country;
		zip = obj.billingAddress.zip;
		phone = obj.billingAddress.phone;
		company = obj.billingAddress.company;
	} else {
		name = obj.firstName;
		street = obj.defaultAddress.street;
		city = obj.defaultAddress.city;
		state = obj.defaultAddress.state;
		country = obj.defaultAddress.country;
		zip = obj.defaultAddress.zip;
		phone = obj.defaultAddress.phone;
		company = obj.defaultAddress.company;
	}
	if(obj.hasOwnProperty("lastName")) {
		lastName = obj.lastName;
	}
	var postData = {
		customer : {
			first_name : name,
			last_name : lastName,
			email : obj.email,
			verified_email : true,
			addresses : [{
				address1 : street,
				city : city,
        		province : state,
       			phone : phone,
        		zip : zip,
        		last_name : lastName,
                first_name: name,
        		country:country
			}],
			"send_email_welcome": false
		}
	};
	var args = {
		data : postData,
		headers : {
			Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword),
			"Content-Type": 'application/json',
			Accept : 'application/json'
		}
	};
	client.post(url, args, function(data, res) {
		var status = parseInt(res.statusCode/100);
		if(status == 2) {
			post(data, node);
		} else {
			if(data.hasOwnProperty("errors")) {
				errMsg = data.errors;
			}
			console.log('errMsg..............%j',data);
			// emitter.emit('error', errMsg, args.data, url, node);
		}
	}).on('error', function(err) {
		console.log(errMsg, err.request.options);
		// emitter.emit('error', args.data, url, node);
	});
}

function run(node) {
	var nodeType = node.connector.type;
	var url = "https://"+storeName+".myshopify.com/admin/";
    var type =  node.connection.option.toLowerCase();
	if(nodeType.toLowerCase() == "action") {
		postAction(url, type, node);		
	} else {	 
		var args = {
	        headers:{ Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword) }
	    }; 
	    
	    if(type == "customer") {
	    	url += "customers.json";
		} else if(type == "product") {
			url += "products.json";
		} else {
			url += "orders.json";
		}
		getStoreData(url, type, node); 
	}		 	 	
}

function testApp() {
	var url = "https://"+storeName+".myshopify.com/admin/customers.json";
	var args = {
        headers:{ Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword) }
    };
    var result;
    client.get(url, args, function(data, res) {
    	var statusCode = parseInt(res.statusCode/100);    	
    	if( statusCode == 2 ){
    		result = {
    			status : 'success',
    			response : data
    		};
    	} else {
    		result = {
    			status : 'error',
    			response : data.errors
    		};
    	}
    	console.log(result);
    	return result;
    }).on('error', function(err) {
		console.log(errMsg, err.request.options);
    });
}

function post(resArr, node) {
	console.log("Shopify Response: %j",resArr); 
	node.resData = resArr;
	// emitter.emit('success', node);
		//post req to the core server
}

module.exports = (function () {
	var Shopify = {
	   		 init: function (node) {
	      	  //initial function to get request data
	       		var credentials = node.credentials;
				apiKey = credentials.apiKey;
	        	apiPassword = credentials.apiPassword;
	        	storeName = credentials.storeName;
	        	run(node);
	    	}, 
	    	test: function(request)	 {
	    		var credentials = request.credentials;
	    		apiKey = credentials.apiKey;
	        	apiPassword = credentials.apiPassword;
	        	storeName = credentials.storeName;
	        	testApp();
	    	}
		}
	return Shopify;
})();