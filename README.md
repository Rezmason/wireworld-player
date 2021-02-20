# wireworld player
A multi-implementation Wireworld simulator written in ECMAScript.

[This web app](http://www.rezmason.net/wireworld) reads [MCL](http://www.mirekw.com/ca/ca_files_formats.html#MCell) and special [TXT](https://github.com/Rezmason/wireworldas3/blob/master/examples/txt/test/simple.txt) files, represents them onscreen as instances of the [Wireworld cellular automaton](https://github.com/GollyGang/ruletablerepository/wiki/WireWorld), and runs them at blazing speed.

(Amazing for a web app, anyway. No other CA sim on Earth currently compares to [Golly](http://golly.sourceforge.net/) set to [hyperspeed](http://www.youtube.com/watch?v=BpgA2oCQj9o).)

Written in [ECMAScript](https://en.wikipedia.org/wiki/ECMAScript) and optionally in [WebAssembly](https://webassembly.org), this project has multiple modules that implement its core functionality with slightly different approaches. It's a useful testing ground for potential client performance improvements on the web.
