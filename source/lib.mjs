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
        let output = this.__buffer__.readInt16LE(this.__offest__);  //PAM采用小端序，高地址存放高字节
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
class ReadTrans {
    constructor(reader, container) {
        this.reader = reader;
        this.container = container;
    }
    exportObj() {
        return this.container;
    }
    getPos() {
        const reader = this.reader;
        //Pos里的X和Y坐标是相对于锚点的
        //在实际计算时需要将其与锚点取相反数前的坐标作加法
        this.container.Pos = {
            'left': reader.ReadInt32() / 20,
            'top': reader.ReadInt32() / 20
        };
        return this;
    }
    getMatrix() {
        const reader = this.reader;
        this.container.Matrix = {
            'a': reader.ReadInt32() / 65536,
            'c': reader.ReadInt32() / 65536,
            'b': reader.ReadInt32() / 65536,
            'd': reader.ReadInt32() / 65536,
        };
        return this;        
    }
    getColorSpace() {
        const reader = this.reader;
        this.container.ColorSpace = {
            'red': reader.ReadByte(),
            'green': reader.ReadByte(),
            'blue': reader.ReadByte(),
            'alpha': reader.ReadByte()
        };
        return this;     
    }
    getRotationAngle() {
        this.container.RotationAngle = this.reader.ReadInt16() / 1000;
        return this;
    }
}
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
        let fragmentId = reader.ReadByte();  //计数用id，与对应位图的ref_id一致
        let outLevel = checker.check(fragmentId);
        let ref_id = 0x100*outLevel + fragmentId; //该位图的id，从0开始递增1计数
        let ref_type = reader.ReadByte(); //可能是0x00（引用位图）, 0x80（引用已有元件）, 0x90
        if([0x01, 0x81, 0x91].includes(ref_type)) {
            ref_type--;
            ref_id += 0x100;
        }
        refAppend.push({
           ref_id, ref_type,
           'ref_index': reader.ReadByte(), //与位图在anim.sprites数组中对应的索引相对应
        });
    }
};
const readRefErase = (reader, currentFrame) => {
    let refErase = currentFrame.refErase = [];
    let checker = new OutChecker();
    for(let k = 0, refCount = reader.ReadByte(); k < refCount; k++) {
        let fragmentId = reader.ReadByte();  //计数用id，与对应位图的ref_id一致
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
        let canReadTrans = true;
        //一个空白帧
        if(key === 0x00) {
            continue; 
        }
        if(key === 0x10) {
            currentFrame.stop = true;
            continue;
        }
        //use the current reference table(for the frame block)
        if(key === 0x04 || key === 0x14 || key === 0x24) {}
        //delete items in the reference table before starting the frame block
        if(key === 0x05 || key === 0x15 || key === 0x25) {
            readRefErase(reader, currentFrame);
        }
        //add new items to the reference table
        //claim the reference table
        if(key === 0x06 || key === 0x16 || key === 0x26 || key === 0x0e) {  
            readRefAppend(reader, currentFrame);
        }
        //delete and add items to the reference table
        //reclaim all the reference_index in the reference table
        if(key === 0x07 || key === 0x17 || key === 0x27 || key === 0x0f || key === 0x2f) {
            readRefErase(reader, currentFrame);
            readRefAppend(reader, currentFrame);
        }
        if(key === 0x09) {
            readRefErase(reader, currentFrame);
            canReadTrans = false;
        }
        //开始处理图像变换
        if(canReadTrans) {
            const transCount = reader.ReadByte(); //所有位图变换的总数
            transCount > 0 && (currentFrame.element = []);
            let checker = new OutChecker();  //处理id溢出的情况
            for(let l = 0; l < transCount; l++) {
                let fragmentId = reader.ReadByte();  //计数用id，与对应位图的ref_id一致
                let type = reader.ReadByte();
                let oldType = type;
                let outLevel = checker.check(fragmentId);
                type -= outLevel;
                type = FixType(type, checker);  //暂时未知type计数方法，通过程序暴力修复
                let transform = new ReadTrans(reader, {'idx': 0x100*checker.outLevel + fragmentId});  //创建容器对象
                switch(type) {
                case 0x08:
                    transform.getPos();
                    break;
                case 0x18:
                    transform.getMatrix().getPos();
                    break;
                case 0x28:
                    transform.getPos().getColorSpace();
                    break;
                case 0x38:
                    transform.getMatrix().getPos().getColorSpace();
                    break;
                case 0x48:
                    transform.getRotationAngle().getPos();
                    break;
                case 0x68:
                    transform.getRotationAngle().getPos().getColorSpace();
                    break;
                default:
                    reader.PrintOffest();
                    SaveJSON(frames, 'Fail.json');
                    throw `Can not identify this type：0x${type.toString(16)}；oldType：${oldType.toString(16)}；outLevel：${checker.outLevel}；id：${transform.idx}；transCount: ${transCount}；L：${l}`;
                }
                currentFrame.element[l] = transform.exportObj();
            }            
        }
        if(reader.CheckIfOffestOut()) {
            //检测有无label
            let labelLength = reader.ReadInt16();
            let labelName = reader.ReadBytes(labelLength).toString();
            if(isMainAnims && /^\w+$/.test(labelName)) {
                frames[j-1] && (frames[j-1].stop = true);
                currentFrame.label = labelName;
            } else {
                reader.__offest__ -= labelLength + 2;
            }
            //检测有无script
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
            //imageID：为切割出的图片命名时用
            //resID：与游戏RESOURCES.RTON中的资源id相对应，以便获取切割数据
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
                    //Transform的X和Y锚点，实际在游戏中要取它的相反数
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
            reader.__offest__ += 4;  //4字节的0x00，无意义
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