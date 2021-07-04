![Wireworld screenshot](/readme_assets/screenshot.png?raw=true "The Owen-Moore wireworld computer, viewed in the Wireworld player.")

# Wireworld Player
A multi-implementation Wireworld simulator written in ECMAScript.

_Note: this project is in early, active development. Over time, its implementation and requirements may change._

### Quick Links

[__Try it here.__](https://rezmason.github.io/wireworld-player)

### About

[This web app](http://rezmason.github.io/wireworld-player) reads [MCL](http://www.mirekw.com/ca/ca_files_formats.html#MCell) and special [TXT](https://github.com/Rezmason/wireworldas3/blob/master/examples/txt/test/simple.txt) files, represents them onscreen as instances of the [Wireworld cellular automaton](https://github.com/GollyGang/ruletablerepository/wiki/WireWorld), and will soon _run_ them at blazing speed.

Written in [ECMAScript](https://en.wikipedia.org/wiki/ECMAScript), and possibly some [WebAssembly](https://webassembly.org) soon, this project has _multiple modules_ that implement its core functionality with slightly different approaches. It's a useful testing ground for potential client performance strategies on the web.

### References
- [The Wireworld computer](https://quinapalus.com/wi-index.html) on Quinapalus
- [Entry for Wireworld](https://en.wikipedia.org/wiki/Wireworld) on Wikipedia
- [Writeup on Dr. Dobbs about HashLife](http://web.archive.org/web/20210302212658/https://www.drdobbs.com/jvm/an-algorithm-for-compressing-space-and-t/184406478) (archive.org link, because who knows)
