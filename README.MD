# ReadPam for Plants vs. Zombies 2
PAM is the format of animation files found in some PopCap's games such as Plants vs. Zombies 2.

This program can convert PAM files to JSON files, based on [this wiki page](https://plantsvszombies.fandom.com/wiki/User_blog:TimespaceLY/PAM_Format_Decryption).

Because of some reasons, currently I can't make it perfect and it seems to have some bugs now.

So I decide to publish its source code and everyone can try to make it better.

### Disclaimer
The program is unstable and may not work as expected when it reads some PAM files.

For educational purposes only. You must not use the program for commercial purposes, otherwise the legal issues should be resolved by yourself.

### Build

This program is developed by [Node.js](https://nodejs.org/) and does not need to be built. So you just need to install Node.js on your computer.

### Usage

Make sure you have installed the latest version of Node.js on your computer.

`ReadPam inputFile.pam`

Then it will output three JSON files in a folder called "output".
* SpritesList.JSON-It contains the data of the split images that appear in the animations.
* SubAnimsList.JSON-It contains the data of sub animations. In Adobe Flash the sub animation is usually called "graphic symbol" or "movie clip symbol".
* MainAnims.JSON-It contains the data of the main animation.

### Contribute

Everyone is welcome to make the program better.

