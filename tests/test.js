var store = require('../lib/store.js')();

store.connect('redis://localhost:6379/1');

function testKV(next) {
	store.set([{key:'name', value:'Bob Smith'}], function (err, value) {
		console.log('set name "Bob Smith": err:', err, ', value:', value);
		store.get('name', function (err, value) {
			console.log('get name: err:', err, ', value:', value);
		    store.del('name', function (err, value) {
				console.log('del name: err:', err, ', value:', value);
		    	next();
		    });
	   });
	});
}

function testSET(next) {
	store.sadd([{key:'MySet', value:'Bob'}], function (err, value) {
		console.log('sadd MySet Bob: err:', err, ', value:', value);
		store.sget('MySet', undefined, function (err, values) {
			console.log('sget MySet: err:', err, ', values:', values);
			store.sget('MySet', 'Boby', function (err, value) {
				console.log('sget Boby: err:', err, ', value:', value);
				store.sget('MySet', 'Bob', function (err, value) {
					console.log('sget Bob: err:', err, ', value:', value);
					store.sdel('MySet', 'Bob', function (err, value) {
						console.log('sdel Bob: err:', err, ', value:', value);
						store.sget('MySet', 'Bob', function (err, value) {
							console.log('sget Bob: err:', err, ', value:', value);
							next();
						});
					});
				});
			});
		});
	});
}

testKV(function () {
	testSET(function () {
		store.close();
	});
});