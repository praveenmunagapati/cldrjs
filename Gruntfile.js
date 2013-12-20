module.exports = function(grunt) {

	"use strict";

	var rdefineEnd = /\}\);[^}\w]*$/,
		pkg = grunt.file.readJSON( "package.json" );

	function camelCase( input ) {
		return input.toLowerCase().replace( /[_/](.)/g, function( match, group1 ) {
			return group1.toUpperCase();
		});
	}

	function mountFolder( connect, path ) {
		return connect.static( require( "path" ).resolve( path ) );
	}

	function replaceConsts( content ) {
		return content

			// Replace Version
			.replace( /@VERSION/g, pkg.version )

			// Replace Date yyyy-mm-ddThh:mmZ
			.replace( /@DATE/g, ( new Date() ).toISOString().replace( /:\d+\.\d+Z$/, "Z" ) );
	}

	grunt.initConfig({
		pkg: pkg,
		connect: {
			options: {
				port: 9001,
				hostname: "localhost"
			},
			test: {
				options: {
					middleware: function ( connect ) {
						return [
							mountFolder( connect, "." ),
							mountFolder( connect, "test" )
						];
					}
				}
			}
		},
		jshint: {
			source: {
				src: [ "src/**/*.js", "!src/build/**" ],
				options: {
					jshintrc: "src/.jshintrc"
				}
			},
			grunt: {
				src: [ "Gruntfile.js" ],
				options: {
					jshintrc: ".jshintrc"
				}
			},
			test: {
				src: [ "test/**/*.js" ],
				options: {
					jshintrc: "test/.jshintrc"
				}
			},
			dist: {
				src: [ "dist/**/*.js", "!dist/**/*.min.js" ],
				options: {
					jshintrc: "src/.dist_jshintrc"
				}
			}
		},
		mocha: {
			all: {
				options: {
					urls: [
						"http://localhost:<%= connect.options.port %>/unit.html",
						"http://localhost:<%= connect.options.port %>/unit_unresolved.html"
					]
				}
			}
		},
		requirejs: {
			options: {
				dir: "dist/.build",
				appDir: "src",
				baseUrl: ".",
				optimize: "none",
				skipSemiColonInsertion: true,
				skipModuleInsertion: true,

				// Strip all definitions generated by requirejs.
				// Convert content as follows:
				// a) "Single return" means the module only contains a return statement that is converted to a var declaration.
				// b) "Not as simple as a single return" means the define wrappers are replaced by a function wrapper call and the returned value is assigned to a var.
				// c) "Main" means the define wrappers are removed, but content is untouched. Only for main* files.
				onBuildWrite: function ( id, path, contents ) {
					var name = id
						.replace(/util\//, "");

					// 1, and 2: Remove define() wrap.
					// 3: Remove empty define()'s.
					contents = contents
						.replace( /define\([^{]*?{/, "" ) /* 1 */
						.replace( rdefineEnd, "" ) /* 2 */
						.replace( /define\(\[[^\]]+\]\)[\W\n]+$/, "" ); /* 3 */

					// Type b (not as simple as a single return)
					if ( [ "item/lookup", "util/json/merge" ].indexOf( id ) !== -1 ) {
						contents = "	var " + camelCase( name ) + " = (function() {" +
							contents + "}());";
					}
					// Type a (single return)
					else if ( !(/^main/).test( id ) ) {
						contents = contents
							.replace( /	return/, "	var " + camelCase( name ) + " =" );
					}

					return contents;
				}
			},
			bundle: {
				options: {
					modules: [{
						name: "cldr",
						include: [ "main" ],
						create: true,
						override: {
							wrap: {
								startFile: "src/build/intro.js",
								endFile: "src/build/outro.js"
							}
						}
					}, {
						name: "cldr_supplemental",
						include: [ "main_supplemental" ],
						exclude: [ "main" ],
						create: true,
						override: {
							wrap: {
								startFile: "src/build/intro_supplemental.js",
								endFile: "src/build/outro.js"
							}
						}
					}, {
						name: "cldr_unresolved",
						include: [ "main_unresolved" ],
						exclude: [ "main" ],
						create: true,
						override: {
							wrap: {
								startFile: "src/build/intro_unresolved.js",
								endFile: "src/build/outro.js"
							}
						}
					}]
				}
			}
		},
		copy: {
			options: {
				processContent: function( content ) {

					// Remove leftover define created during rjs build
					content = content.replace( /define\(".*/, "" );

					// Embed VERSION and DATE
					return replaceConsts( content );
				}
			},
			dist_cldr: {
				expand: true,
				cwd: "dist/.build/",
				src: [ "cldr.js" ],
				dest: "dist/"
			},
			dist_modules: {
				expand: true,
				cwd: "dist/.build/",
				src: [ "cldr*.js", "!cldr.js" ],
				dest: "dist/cldr",
				rename: function( dest, src ) {
					return require( "path" ).join( dest, src.replace( /cldr_/, "" ) );
				}
			},
			dist_node_main: {
				src: "src/build/node_main.js",
				dest: "dist/node_main.js"
			}
		},
		uglify: {
			options: {
				banner: replaceConsts( grunt.file.read( "src/build/intro.min.js" ) )
			},
			dist: {
				files: {
					"dist/cldr.min.js": [ "dist/cldr.js" ],
					"dist/cldr/supplemental.min.js": [ "dist/cldr/supplemental.js" ],
					"dist/cldr/unresolved.min.js": [ "dist/cldr/unresolved.js" ]
				}
			}
		}
	});

	require( "matchdep" ).filterDev( "grunt-*" ).forEach( grunt.loadNpmTasks );

	grunt.registerTask( "test", [
		"connect:test",
		"mocha"
	]);

	grunt.registerTask( "default", [
		"jshint:grunt:source:test",
		"test",
		"requirejs",
		"copy",
		"jshint:dist",
		"uglify"
	]);

};

