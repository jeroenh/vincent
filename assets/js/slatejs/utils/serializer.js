import React from 'react';
import escapeHtml from 'escape-html'
import { Text } from 'slate'
import { jsx } from 'slate-hyperscript'
import { css } from '@emotion/css'


function getIcon(url) {

    const extension = url.split('.').pop()

    if (["doc", "docx"].includes(extension)) {
        return "<i class=\"fas fa-file-word\"></i>";
    }else if (["xls", "xlst"].includes(extension)) {
        return "<i class=\"fas fa-file-excel\"></i>";
    } else if (["ppt", "pptx"].includes(extension)) {
        return "<i class=\"fas fa-file-powerpoint\"></i>";
    } else if (["pdf"].includes(extension)) {
        return "<i class=\"fas fa-file-pdf\"></i>";
    } else if (["zip", "tar", "tarz", "bzip", "7z"].includes(extension)) {
        return "<i class=\"fas fa-file-archive\"></i>";
    } else if (["json", "xml", "html", "py", "sh"].includes(extension)) {
	return "<i class=\"fas fa-code\"></i>"
    } else if (["mov"].includes(extension)) {
	return "<i class=\"fas fa-video\"></i>"
    } else {
	return "<i class=\"fas fa-file\"></i>"
    }
}


export const serializer = node => {

    if (Text.isText(node)) {

	let string = escapeHtml(node.text)
	if (node.bold) {
	    string = `<strong>${string}</strong>`
	}
	if (node.italic) {
	    string = `<em>${string}</em>`
	}
	if (node.underline) {
	    string = `<u>${string}</u>`
	}
	if (node.code) {
	    string = `<code>${string}</code>`
	}
	return string
    }

    const children = node.children.map(n => serializer(n)).join('')

    let style = "";
    
    if (node.align) {
	style = `style="text-align: ${node.align}"`;
    }
    
    switch (node.type) {
    case 'code':
	return `<pre><code>${children}</code></pre>`
    case 'block-quote':
	return `<blockquote><p>${children}</p></blockquote>`
    case 'paragraph':
	return `<p ${style}>${children}</p>`
    case 'link':
	return `<a href="${escapeHtml(node.href)}">${children}</a>`
    case 'bulleted-list':
	return `<ul ${style}>${children}</ul>`
    case 'heading-one':
	return `<h1 ${style}>${children}</h1>`
    case 'heading-two':
	return `<h2 ${style}>${children}</h2>`
    case 'list-item':
	return `<li>${children}</li>`
    case 'numbered-list':
	return `<ol ${style}>${children}</ol>`
    case 'bulleted-list':
        return `<ul ${style}>${children}</ul>`
    case 'file':
	const fsrc = node.url;
	const falt = node.children[0]?.text;
	const icon = getIcon(node.children[0]?.text);
	return `<a href="${escapeHtml(fsrc)}">${icon} ${falt}</a>` 
    case 'image':
	const src = node.url;
	const alt = node.children[0]?.text;
	return `<a href="${escapeHtml(src)}"><img src="${src}" alt="${alt}" ${style}/></a>`
    case 'mention':
	return `<span class="mention" data-id="${node.participant}">@${node.character}</span>`
    default:
	return children
    }
}


export const deserializer = (el, markAttributes = {}) => {

    if (el.nodeType === Node.TEXT_NODE) {
	return jsx('text', markAttributes, el.textContent)
    } else if (el.nodeType !== Node.ELEMENT_NODE) {
	return null
    }

    const nodeAttributes = { ...markAttributes }
    
    // define attributes for text nodes
    switch (el.nodeName) {
    case 'STRONG':
	nodeAttributes.bold = true
    }

    const children = Array.from(el.childNodes)
    .map(node => deserializer(node, nodeAttributes))
	  .flat()
    
    if (children.length === 0) {
	children.push(jsx('text', nodeAttributes, ''))
    }

    switch (el.nodeName) {
    case 'BODY':
	return jsx('fragment', {}, children)
    case 'BR':
	return '\n'
    case 'BLOCKQUOTE':
	return jsx('element', { type: 'quote' }, children)
    case 'P':
	return jsx('element', { type: 'paragraph' }, children)
    case 'A':
	return jsx(
            'element',
            { type: 'link', href: el.getAttribute('href') },
            children
	)
	//children: {text: el.getAttribute('alt')}},
    case 'IMG':
	return jsx(
	    'element',
	    { type: 'image', url: el.getAttribute('src'), alt: el.getAttribute('alt') },
	    children
	)
    case 'SPAN':
	return jsx(
	    'element',
	    {type: 'mention', character: el.textContent.slice(1), participant: el.getAttribute('data-id')}, children )
    case 'OL':
	return jsx('element', {type: 'numbered-list'}, children)
    case 'UL':
	return jsx('element', {type: 'bulleted-list'}, children)
    case 'LI':
	return jsx('element', {type: 'list-item'}, children)
    case 'STRONG':
	return jsx("text", {bold: true}, children);
    case 'EM':
	return jsx("text", {italic: true}, children);
    case 'U':
	return jsx("text", {underline: true}, children);
    case 'CODE':
	return jsx("text", {code: true}, children);	
    default:
	return children
    }
}

