import { Editor, Transforms } from "slate";
import { createLinkNode, insertLink } from "./link.js";

const pdRE = /^(?:\w+:)?\/\/(\S+)$/;

const localRE = /^localhost[\:?\d]*(?:[^\:?\d]\S*)?$/
const nonLocalRE = /^[^\s\.]+\.\S{2,}$/;


const imageExts = ["art", "bmp", "jpeg", "jpg", "ico", "gpl", "gif", "mng", "pbm", "raw", "sgi", "pict", "tiff", "tif", "xpm", "xbm", "int", "rgb", "rle", "svg", "stl", "art", "png", "x3d", "ecw", "iff", "heic", "heif", "rgb", "rgba", "sun", "xar", "vnd", "x3d"]

function isUrl(string){
  if (typeof string !== 'string') {
    return false;
  }

    var match = string.match(pdRE);
    if (!match) {
	return false;
    }
    
    var ap = match[1];
    if (!ap) {
	return false;
    }
    
    if (localRE.test(ap) || nonLocalRE.test(ap)) {
	return true;
    }
    
    return false;
}

export const insertImage = (editor, url, filename) => {
    const text = { text: filename }

    var image = null;

    const ext = filename.split('.').pop()
    
    if (imageExts.includes(ext)) {
	image = { type: 'image', url, children: [text] }
    } else {
	image = { type: 'file', url, children: [text] }
    }

    Transforms.insertNodes(editor, image)
    
    const paragraph = {
      type: 'paragraph',
      children: [{ text: '' }],
    }

    Transforms.insertNodes(editor, paragraph)
    Transforms.move(editor, { edge: "end" });
}

export const isImageUrl = url => {
    if (!isUrl(url)) return false
    const ext = new URL(url).pathname.split('.').pop()
    return imageExts.includes(ext);
}
