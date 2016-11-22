var Client = require('node-rest-client').Client;
var client = new Client();

var apiKey,apiPassword,storeName;

function getStoreData(url,args,type,req) {
	client.get(url, args, function (data, res) {
			if(type == "customer") {
				formCustomer(data.customers,req);
			} else if (type == "product") {
				formProduct(data.products,req);
			} else {
				formOrder(data.orders,req)
			}
    	}).on('error',function(err){
        	console.log('something went wrong on the request', err.request.options);
    });
}

function b64EncodeUnicode(str) {
   	return new Buffer(str).toString('base64');
}

function formCustomer(dataArr, req) {
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
		post(resArr, req);
	}

function formOrder(dataArr, req) {
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
			items[i] = item;
			quantity += itemObj.quantity;
		}
		resObj.items = items;
		resObj.quantity = quantity;
		resArr[i] = resObj;
	}
	post(resArr, req);
}

function formProduct(dataArr,req) {
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
	post(resArr, req);
}

function run(node) {
	var entity = node.reqData.entity;
	var args = {
        headers:{Authorization : "Basic "+b64EncodeUnicode(apiKey+":"+apiPassword)}
    }; 
    var url = "https://"+storeName+".myshopify.com/admin/";
    var type =  entity.type;
    if(type == "customer") {
    	url += "customers.json";
		} else if(type == "product") {
		url += "products.json";
	} else {
		url += "orders.json";
	}  
 	getStoreData(url,args, type, node);  	
}

function post(resArr, node) {
	console.log("****************RESPONSE**************  %j",resArr);
	node.reqData.preData = resArr;
		//post req to the core server
}

module.exports = (function () {
	var Shopify = {
	   		 init: function (node) {
	      	  //initial function to get request data
	       		var credentials = node.reqData.credentials;
				apiKey = credentials[0];
	        	apiPassword = credentials[1];
	        	storeName = credentials[2];
	        	run(node);
	    	}	
		}
	return Shopify;
})();


