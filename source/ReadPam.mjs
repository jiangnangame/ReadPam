"use strict";
import fs from 'fs';
const SaveJSON = (object, fileName) => {
    fs.writeFileSync(fileName, JSON.stringify(object, null, 4));
    console.log('Output JSON Successfully: ' + fileName);
};
class Reader {
    constructor(buf, offest = 0) {
        this.__buffer__ = buf;
        this.__offest__ = offest;
    }
    PrintOffest(decimal = 16) {
        console.log(`offest：${this.__offest__.toString(decimal)}`);
    }
    CheckIfOffestOut() {
        return this.__offest__ < this.__buffer__.length;
    }
    ReadInt16() {
        let output = this.__buffer__.readInt16LE(this.__offest__);
        this.__offest__ += 2;
        return output;
    }
    ReadInt32() {
        let output = this.__buffer__.readInt32LE(this.__offest__);
        this.__offest__ += 4;
        return output;
    }
    ReadByte() {
        return this.__buffer__[this.__offest__++];
    }
    ReadBytes(length) {
        return this.__buffer__.slice(this.__offest__, this.__offest__ += length);
    }
};
class OutChecker {
    constructor() {
        this.lastFragmentId = 0;
        this.outLevel = 0;
    }
    check(fragmentId) {
        if(fragmentId < this.lastFragmentId) {
             this.outLevel++;
        }
        this.lastFragmentId = fragmentId;
        return this.outLevel;
    }
};
const readRefAppend = (reader, currentFrame) => {
    let refAppend = currentFrame.refAppend = [];
    let checker = new OutChecker();
    for (let k = 0, refCount = reader.ReadByte(); k < refCount; k++) {
        let fragmentId = reader.ReadByte();  
        let outLevel = checker.check(fragmentId);
        let ref_id = 0x100*outLevel + fragmentId; 
        let ref_type = reader.ReadByte(); 
        if([0x01, 0x81, 0x91].includes(ref_type)) {
            ref_type--;
            ref_id += 0x100;
        }
        refAppend.push({
           ref_id, ref_type,
           'ref_index': reader.ReadByte(),
        });
    }
};
const readRefErase = (reader, currentFrame) => {
    let refErase = currentFrame.refErase = [];
    let checker = new OutChecker();
    for(let k = 0, refCount = reader.ReadByte(); k < refCount; k++) {
        let fragmentId = reader.ReadByte(); 
        let outLevel = checker.check(fragmentId);
        let ref_id = 0x100*outLevel + fragmentId;
        let ref_ident = reader.ReadByte();
        ref_ident !== 0 && (ref_id += 0x100);
        refErase.push({ref_id, ref_ident});
    }
};
const FixType = (type, checker) => {
    let list = [0x08, 0x18, 0x28, 0x38, 0x48, 0x68];
    let threshold = 3;
    while(!list.includes(type) && threshold > 0) {
        type--;
        checker.outLevel++;
        threshold--;
    }
    return type;
};
const readScript = (reader, currentFrame) => {
     let scrKey = reader.ReadByte();
     let keep = true;
     if(scrKey === 0x01 || scrKey === 0x02) {
         currentFrame.FSCmd = [];
         while(keep) {
             let cmdLength = reader.ReadInt16();
             let cmdName = reader.ReadBytes(cmdLength).toString();
             if(/^[\w+|\0x20]+$/.test(cmdName)) {
                currentFrame.FSCmd.push({
                    'CmdName': cmdName,
                    'Arg': reader.ReadBytes(reader.ReadInt16()).toString()
                });
            } else {
                reader.__offest__ -= cmdLength + 2;
                keep = false;
            }             
         }
         return;
    }
    reader.__offest__ -= 1;
};
const readTransformBlock = (reader, frameNum, isMainAnims) => {
    let frames = global.frames = [];
    let j = 0;
    for(; j < frameNum; j++) {
        frames.push({});
        const currentFrame = frames[j];
        const key = reader.ReadByte();
        if(key === 0x00) {
            continue; 
        }
        if(key === 0x10) {
            currentFrame.stop = true;
            continue;
        }
        if(key === 0x04 || key === 0x14 || key === 0x24) {}
        if(key === 0x05 || key === 0x15 || key === 0x25) {
            readRefErase(reader, currentFrame);
        }
        if(key === 0x06 || key === 0x16 || key === 0x26 || key === 0x0e) {  
            readRefAppend(reader, currentFrame);
        }
        if(key === 0x07 || key === 0x17 || key === 0x27 || key === 0x0f || key === 0x2f) {
            readRefErase(reader, currentFrame);
            readRefAppend(reader, currentFrame);
        }
        const transCount = reader.ReadByte();
        transCount > 0 && (currentFrame.element = []);
        let checker = new OutChecker();
        for(let l = 0; l < transCount; l++) {
            let fragmentId = reader.ReadByte();
            let type = reader.ReadByte();
            let outLevel = checker.check(fragmentId);
            type -= outLevel;
            type = FixType(type, checker);
            let transform = {'idx': 0x100*checker.outLevel + fragmentId};
            switch(type) {
            case 0x08:
                transform.Pos = {
                    'left': reader.ReadInt32() / 20,
                    'top': reader.ReadInt32() / 20
                };
                break;
            case 0x18:
                transform.Matrix = {
                    'a': reader.ReadInt32() / 65536,
                    'c': reader.ReadInt32() / 65536,
                    'b': reader.ReadInt32() / 65536,
                    'd': reader.ReadInt32() / 65536,
                };
                transform.Pos = {
                    'left': reader.ReadInt32() / 20,
                    'top': reader.ReadInt32() / 20
                };
                break;
            case 0x28:
                transform.Pos = {
                    'left': reader.ReadInt32() / 20,
                    'top': reader.ReadInt32() / 20
                };
                transform.ColorSpace = {
                    'red': reader.ReadByte(),
                    'green': reader.ReadByte(),
                    'blue': reader.ReadByte(),
                    'alpha': reader.ReadByte()
                };
                break;
            case 0x38:
                transform.Matrix = {
                    'a': reader.ReadInt32() / 65536,
                    'c': reader.ReadInt32() / 65536,
                    'b': reader.ReadInt32() / 65536,
                    'd': reader.ReadInt32() / 65536,
                };
                transform.Pos = {
                    'left': reader.ReadInt32() / 20,
                    'top': reader.ReadInt32() / 20
                };
                transform.ColorSpace = {
                    'red': reader.ReadByte(),
                    'green': reader.ReadByte(),
                    'blue': reader.ReadByte(),
                    'alpha': reader.ReadByte()
                };
                break;
            case 0x48:
                transform.RotationAngle = reader.ReadInt16() / 1000;
                transform.Pos = {
                    'left': reader.ReadInt32() / 20,
                    'top': reader.ReadInt32() / 20
                };
                break;
            case 0x68:
                transform.RotationAngle = reader.ReadInt16() / 1000;
                transform.Pos = {
                    'left': reader.ReadInt32() / 20,
                    'top': reader.ReadInt32() / 20
                };
                transform.ColorSpace = {
                    'red': reader.ReadByte(),
                    'green': reader.ReadByte(),
                    'blue': reader.ReadByte(),
                    'alpha': reader.ReadByte()
                };
                break;
            default:
                SaveJSON(frames, 'Fail.json');
                throw `Can't identify this type: 0x${type.toString(16)} \n Offest: ${reader.__offest__.toString(16)}`;
            }
            currentFrame.element[l] = transform;
        }
        if(reader.CheckIfOffestOut()) {
            let labelLength = reader.ReadInt16();
            let labelName = reader.ReadBytes(labelLength).toString();
            if(isMainAnims && /^\w+$/.test(labelName)) {
                frames[j-1] && (frames[j-1].stop = true);
                currentFrame.label = labelName;
            } else {
                reader.__offest__ -= labelLength + 2;
            }
            isMainAnims && readScript(reader, currentFrame);
        }
    }
    isMainAnims && frames[j-1] && (frames[j-1].stop = true);
    return frames;
}
export default class ReadPam {
    constructor(pamName) {
        this.reader = new Reader(fs.readFileSync(pamName), 17);
    }
    start(jsonPath) {
        const {reader} = this;
        SaveJSON(this.readSprites(reader, []), jsonPath + 'SpritesList.json');
        SaveJSON(this.readSubAnims(reader, []), jsonPath + 'SubAnimsList.json');
        SaveJSON(this.readMainAnims(reader, {}), jsonPath + 'MainAnims.json');
    }
    readSprites(reader, sprites) {
        let spriteCount = reader.ReadInt16();
        for(let i = 0; i < spriteCount; i++) {
            let nameLength = reader.ReadInt16();
            let {groups: {imageID, resID}} = /(?<imageID>\w+)\|(?<resID>\w+)/.exec(reader.ReadBytes(nameLength).toString());
            sprites.push({
                imageID, resID,
                'properties': {
                    "width": reader.ReadInt16(),
                    "height": reader.ReadInt16(),
                    "a": reader.ReadInt32() / 65536,
                    "c": reader.ReadInt32() / 65536,
                    "b": reader.ReadInt32() / 65536,
                    "d": reader.ReadInt32() / 65536,  
                    "left": reader.ReadInt16() / 20,
                    "top": reader.ReadInt16() / 20,
                }
            });
        }
        return sprites;
    }
    readSubAnims(reader, subAnims) {
        let subAnimCount = reader.ReadInt16();
        for(let i = 0; i < subAnimCount; i++) {
            let nameLength = reader.ReadInt16();
            let sub = {
                'name': reader.ReadBytes(nameLength).toString(),
            };
            reader.__offest__ += 4;
            sub.info = {
                'fps': reader.ReadInt16(),
                'frameNum': reader.ReadInt16(),
                'startingFrame': reader.ReadInt16(),
                'endingFrame': reader.ReadInt16(),
            };
            sub.frames = readTransformBlock(reader, sub.info.frameNum);
            subAnims.push(sub);
        }
        return subAnims;
    }
    readMainAnims(reader, mainAnims) {
        reader.__offest__ += 7;
        mainAnims.info = {
            'fps': reader.ReadInt16(),
            'frameNum': reader.ReadInt16(),
            'startingFrame': reader.ReadInt16(),
            'endingFrame': reader.ReadInt16(),
        };
        mainAnims.frames = readTransformBlock(reader, mainAnims.info.frameNum, true);
        return mainAnims;
    }
}