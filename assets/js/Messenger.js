import React, {useEffect, useCallback, createRef, forwardRef, useState, useRef, useImperativeHandle} from 'react';
import DOMPurify from 'dompurify';
import RichTextEditor from './slatejs/richtext.jsx';
import {serializer} from "./slatejs/utils/serializer.js"

const initialValue = [
    {
        type: 'paragraph',
        children: [{ text: '' }],
    },
]

// Specify a configuration directive #example for custom DOMPurify
const config = {
    ADD_ATTR: ['mention-id', 'data-id'], // permit mention related attributes
    ADD_TAGS: ['span'], // permit additional custom tags
};

const Messenger = forwardRef((props, ref) => {

    const [initialVal, setInitialVal] = useState(null);
    const [text,setText] = useState(props.value || initialValue);

    const editorRef = React.createRef(null);

    const handleChange = (html) => {
        setInitialVal(null);
	props.setValue(html);
	setText(html);	
    }

    const sanitizeHTML = (text) => {
	let html = serializer({children: text});
        return DOMPurify.sanitize(html, config);
    };

    const clearText = (e) => {
        if (e) {
            e.preventDefault()
        }
        setInitialVal(initialValue);
        setText(initialValue);
    }

    /* useImperativeHandle is a React Hook that lets you customize the handle exposed as a ref. */
    
    useImperativeHandle(ref, () => ({
        clearText,
	sanitizeHTML,
    }));
    
  
    return (
	
	<RichTextEditor
	    style={props.style || {
                height: '25vh',
                fontSize: '18px',
                marginBottom: '20px',
		paddingBottom: '40px',
            }}
            ref={editorRef}
            setValue={handleChange}
            value={text}
            initialValue={initialVal}
	    people={[]}
	    uploadFiles={props.uploadFiles}
	    className={props.className || ""}
	    placeholder={props.placeholder}
        />       
    );

})

export default Messenger;
