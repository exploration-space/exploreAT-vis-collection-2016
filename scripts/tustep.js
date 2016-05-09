#!/usr/bin/env node

var glob = require('glob');
var fs = require('fs');
var path = require('path');
var xml2js = require('xml2js');
var util = require('util');
var _ = require('underscore');


var elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({
    host: 'localhost:9200'
});

var finalObj;

if (process.argv[2] == 'undefined' || process.argv[2].length == 0) {
    console.warn('You must provide a root directory of XML files')
}

if(fs.statSync(process.argv[2]).isFile()) {
    finalObj = require(process.argv[2]);

    var bulk_request = [];

    function wordTypeNameForType(type) {
        var typeName = "";
        switch (type) {
            case "0":
                typeName = "prefix";
                break;
            case "1":
                typeName = "noun";
                break;
            case "2":
                typeName = "adjective";
                break;
            case "3":
                typeName = "adverb";
                break;
            case "4":
                typeName = "numeral";
                break;
            case "5":
                typeName = "pronoun";
                break;
            case "6":
                typeName = "verb";
                break;
            case "7":
                typeName = "preposition";
                break;
            case "8":
                typeName = "conjunction";
                break;
            case "9":
                typeName = "interjection";
                break;
        }
        return typeName;
    }
    var empty = 0;
    var oneChar = 0;
    var counter = 0;
    for (var i in finalObj) {
        counter++;
        var test = i.match(/:\d/g);
        if (test == 'undefined' || !test) {
            empty++;
            continue;
        }

        var typeName = wordTypeNameForType(test[0].charAt(1));
        var files = [];
        var totalCount = 0;

        for (var k in finalObj[i]) {
            if (k == "count")
                totalCount = finalObj[i][k];
            else if (k !== "year") {
                files.push({
                    "fileName": k,
                    "count": finalObj[i][k]
                });
            }
        }
        var rawLemma = i.replace(/:\d/g, "");

        if (rawLemma.length == 0 || rawLemma == 'undefined' || rawLemma.length == 1) {
            oneChar++;
            continue;
        }


        var body = {
            "totalCount": totalCount,
            "files": files,
            "wordType": typeName
        };

        if (finalObj[i].hasOwnProperty("year")) {
            body["years"] = finalObj[i]["year"].filter(function(element){
                return parseInt(element, 10) <= 2015 && element !== 'unknown';
            }).sort(function(a,b) {
                return parseInt(a, 10) - parseInt(b, 10);
            })
        }

        var leftLemma = rawLemma.match(/\((.*?)\)/);

        if (leftLemma == 'undefined' || leftLemma == null || leftLemma.length == 0) {
            if (rawLemma.length == 0 || rawLemma.length == 1 || rawLemma == 'undefined') {
                console.log(i);
                continue;
            }
            body['mainLemma'] = rawLemma;
            body['isMain'] = true;
        } else {
            leftLemma = leftLemma[1];
            rawLemma = rawLemma.split(')')[1];
            if (rawLemma.length == 0 || rawLemma.length == 1 || rawLemma == 'undefined') {
                console.log(i);
                continue;
            }
            body['mainLemma'] = rawLemma;
            body['leftLemma'] = leftLemma;
        }

        bulk_request.push({index: {_index: 'tustep', _type: 'tustep-type'}});
        bulk_request.push(body);

        // addToES(body);

        // client.index({
        //     index: 'tustep',
        //     type: 'type-tustep',
        //     body: {"bla": "blablablabla"}
        // }, function (err, response) {
        //     if (err) {
        //         console.error(err.stack);
        //     } else {
        //         console.log('Successfully indexed object');
        //     }
        // });
    }

// _.forEach(bulk_request, function(body, idx) {
//     client.index({
//         index: 'tustep',
//         type: 'tustep-type',
//         body: body
//     }, function(err, response) {
//         if (err) {
//             console.error(err.stack);
//         } else {
//             console.log('Successfully indexed object with number ' + idx);
//             if (idx == length)
//                 process.exit(0);
//         }
//     });
// });


    console.log('Finished. ' + empty + ' empty lemmas and ' + oneChar + ' of length 1. \n' +
        'Total discarded: ' + (empty + oneChar) + ' out of ' + counter);
// A little voodoo to simulate synchronous insert
    var busy = false;
    var callback = function(err, resp) {
        if (err) { console.log(err); }

        busy = false;
    };

// Recursively whittle away at bulk_request, 1000 at a time.
    var perhaps_insert = function(){
        if (!busy) {
            busy = true;
            client.bulk({
                body: bulk_request.slice(0, 1000)
            }, callback);
            bulk_request = bulk_request.slice(1000);
            console.log(bulk_request.length);
        }

        if (bulk_request.length > 0) {
            setTimeout(perhaps_insert, 10);
        } else {
            console.log('Inserted all records.');
            process.exit(0);
        }
    };


    perhaps_insert();


} else {

    var dir = process.argv[2];
    console.log('Recursively analyzing ' + dir);

    var contents = fs.readdirSync(dir);

    var subdirs = [];

    contents.forEach(function(content) {
        if(fs.statSync(path.join(dir, content)).isDirectory())
            subdirs.push(content);
    });

    console.log('Found ' + JSON.stringify(subdirs));

    var lemmas = {};
    var counter = 0;
    subdirs.forEach(function(subdir) {
        var letterPath = path.join(dir, subdir);
        var files = glob.sync(letterPath + '/*2-3.xml');
        console.log(files.length + ' XML files found in directory ' + letterPath);
        files.forEach(function(file) {
            var parser = new xml2js.Parser();
            // console.log(file);
            parser.parseString(fs.readFileSync(file), function (err, result) {
                // var jsonResult = JSON.stringify(result);
                if (result.hasOwnProperty("records")) {
                    if (result.records.hasOwnProperty("record")) {
                        result.records.record.forEach(function(record) {
                            if (record.hasOwnProperty("field")) {
                                var lemma;
                                record["field"].forEach(function(theField) {
                                    if(theField["$"].name == "HL") {
                                        lemma = theField["_"];
                                        if (lemma) {
                                            lemma = lemma.replace(" ", "");
                                            lemma = lemma.toLowerCase();
                                            // console.log('Lemma found: ' + lemma);
                                            if (lemmas.hasOwnProperty(lemma)) {
                                                if (lemmas[lemma].hasOwnProperty(file)) {
                                                    var num = lemmas[lemma][file];
                                                    lemmas[lemma][file] = num + 1;
                                                } else {
                                                    lemmas[lemma][file] = 1;
                                                }
                                                lemmas[lemma]["count"] += 1;


                                            } else {
                                                lemmas[lemma] = {};
                                                lemmas[lemma]["count"] = 1;
                                                lemmas[lemma][file] = 1;
                                            }
                                        }
                                    } else if (theField["$"].name == "QDB") {
                                        if (lemma == null || lemmas[lemma] == null || lemmas[lemma] == 'undefined') {
                                            console.log('Lemma is null');

                                        } else {
                                            var match = theField["_"].match(/\d{4}/);
                                            if (match == 'undefined' || match == null) {
                                                if (lemmas[lemma].hasOwnProperty("year")) {
                                                    if (lemmas[lemma]["year"].indexOf('unknown') == -1)
                                                        lemmas[lemma]["year"].push('unknown');
                                                } else {
                                                    lemmas[lemma]["year"] = [];
                                                    lemmas[lemma]["year"].push('unknown');
                                                }
                                            } else {
                                                match.forEach(function(theMatch, idx) {
                                                    if (idx == 0) {
                                                        if (lemmas[lemma].hasOwnProperty("year")) {
                                                            if (lemmas[lemma]["year"].indexOf(theMatch) == -1)
                                                                lemmas[lemma]["year"].push(theMatch);
                                                        } else {
                                                            lemmas[lemma]["year"] = [];
                                                            lemmas[lemma]["year"].push(theMatch);
                                                        }

                                                    }
                                                });
                                            }
                                        }
                                    }
                                });
                            } else {
                                console.log('Record has no fields');
                            }
                        });
                    }
                }
            });
        });
    });

    fs.writeFile('results.json', JSON.stringify(lemmas),  function(err) {
        if (err) throw err;
        console.log('It\'s saved!');
        process.exit(0);
    });
}




// lemmas.forEach(function (lemma) {
//     client.index({
//         index: 'tustep',
//         type: 'tweet',
//         body: {"name" : lemma,
//             "files" : lemmas[lemma]}
//     }, function (err, resp) {
//         // console.log(resp);
//         if (err) throw err;
//     });
// });






