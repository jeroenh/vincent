import React, {useEffect, useCallback, createRef, useState, useRef} from 'react';
//import ReactQuill, { Quill,editor } from 'react-quill';
import RichTextEditor from './slatejs/richtext.jsx';
import {Alert, Form } from "react-bootstrap";
import {serializer, deserializer} from "./slatejs/utils/serializer.js"
import axios from 'axios'
import CaseThreadAPI from './ThreadAPI';
import DOMPurify from 'dompurify';

// Import the Slate editor factory.

let appConfig = {};
try {
	appConfig = JSON.parse(window.VINCENT_DATA);
} catch (e) {}
const API_URL = appConfig.api_url || 'http://localhost:8000/cvdp';

const threadapi = new CaseThreadAPI();

const initialValue = [
    {
        type: 'paragraph',
        children: [{ text: '' }],
    },
]

// Specify a configuration directive #example for custom DOMPurify
const config = {
    ADD_ATTR: ['mention-id', 'style', 'data-id', 'classname'], // permit mention related attributes
    ADD_TAGS: ['span', 'img', 'em', 'u', 'code'], // permit additional custom tags
};

export default function Editor(props) {
    const [reply, setReply] = useState("");
    const [text,setText] = useState(null);
    const editorRef = React.createRef(null);
    const cardRef = useRef(null);
    const [users, setUsers] = useState(props.participants);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [invalidPost, setInvalidPost] = useState(false);
    const [initialVal, setInitialVal] = useState(null);
    const [fileReload, setFileReload] = useState(false);
    const [placeholder, setPlaceholder] = useState("Post a message or @ to tag someone");

    
    const handleChange = (html) => {
	setInitialVal(null);
	setText(html);
	setInvalidPost(false);
    }

    useEffect(() => {
	if (props.post) {
	    const doc = new DOMParser().parseFromString(props.post.content, 'text/html')
	    const slate_json = deserializer(doc.body);
	    if (Array.isArray(props.post.json) && props.post.json?.length > 0) {
		setText(props.post.json);
		/*try {
		    let c = JSON.parse(props.post.json);
		    setText(c);
		}
		catch {
		    setText(props.post.json);
		}*/
	    } else {
		setText(slate_json);
	    }
	} else {
	    setText(initialValue);
	}
    }, [props.post]);

    useEffect(() => {
	
	if (props.reply) {

	    let reply = [{type: 'paragraph', children: [{type: "mention", character: `${props.reply.author.name}`, participant: `${props.reply.author.participant}`, children:[{text:""}]}]}]
	    setText(reply);
	    setInitialVal(reply);
	    console.log("scrolling");
	    cardRef.current.scrollIntoView();

	}
    }, [props.reply]);

    useEffect(() => {
	let u = [...props.participants];
	let ph = [];
	props.participants.forEach(x => {
	    if (x.participant.users?.length > 0) {
		x.participant.users.forEach(ux => {
		    if (!u.some(y => (y.participant.id == x.participant.id && y.participant.name === ux))) {
			u.push({'id': x.participant.id, participant: {name: `${ux}`, group: `(${x.participant.name})`, id: x.participant.id}});
		    }
		});
	    }
	    if (props.user?.user?.name != x.participant.name) {
		ph.push(x.participant.name);
	    }
	});
	setUsers(u);

	if (props.thread?.official) {
	    setPlaceholder(`Post a message or @ to tag someone`);
	} else if (ph.length > 0) {
	    setPlaceholder(`Write to ${ph.join(', ')}`);
	} else {
	    setPlaceholder(`Post a message or @ to tag someone`);
	}
	
    }, [props.participants]);


    const sanitizeHTML = (html) => {
        return DOMPurify.sanitize(html, config);
    };

    const uploadFiles = async(formData, filename, ref) => {
	console.log(`Uploading ${filename}: ${formData}`);
	let data = await threadapi.addPostImage(formData, props.thread)
	let results = await data.data;
	setFileReload(true);
	return results['image_url'];

    };


    const clearText = (e) => {
	if (e) {
	    e.preventDefault()
	}
	if (props.post) {
	    props.dataUpdated()
	}
	setInitialVal(initialValue);
	setText(initialValue);
    }

    const submitPost = async (e) => {
	e.preventDefault();
	let formField = new FormData()

	console.log(text);
	
	if (text === initialValue || JSON.stringify(text) === JSON.stringify(initialValue)) {
	    setInvalidPost(true);
	    return;
	} else {
	    setInvalidPost(false);
	}

	
	let html = sanitizeHTML(serializer({children: text}));

	formField.append('json', JSON.stringify(text))
	formField.append('content', html);

	if (fileReload) {
	    /* reload editor if user has uploaded files */
	    setIsLoading(true);
	    setFileReload(false);
	} 
	
	if (props.post) {
	    /* just need to update this post */
	    await threadapi.editPost(formField, props.post).then((response) => {
		props.dataUpdated()
		setIsLoading(false);
	    }).catch(err => {
		setIsLoading(false);
		if (err.response?.status == 403) {
                    setError(`Unable to post: You do not have adequate permissions to add to this discussion. Please talk to your group administrator or the coordinator on this case.`);
		} else if (err.response) {
		    setError(`Error editing post: ${err.response.data.error}`);
		} else {
		    setError(`Error editing post.`);
		}
	    });
	} else {
	    let url = `${API_URL}/api/case/thread/${props.thread.id}/posts/`;

	    if (props.reply) {
		formField.append('reply', props.reply.id);
	    }
	    await threadapi.addPost(formField, props.thread).then((response) => {
		clearText();
		setIsLoading(false);
		props.dataUpdated();
	    }).catch(err => {
		setIsLoading(false);
		if (err.response.status == 403) {
                    setError(`Unable to post: You do not have adequate permissions to add to this discussion. Please talk to your group administrator or the coordinator on this case.`);
		} else {
		    setError(`Error posting message: ${err.message}`);
		}
	    })
	}
    }

    return (
	<div className="card">
	    {error &&
	     <Alert variant="danger"> {error}</Alert>
	    }
	    {text && users.length > 0 ?
	     <>
		 <Form>
		     <div className="card-body" ref={cardRef}>
			 {isLoading ?

			  <div className="text-center">                                   
                              <div className="lds-spinner">                               
                                  <div></div>                                             
                                  <div></div>                                             
                                  <div></div>                                             
                              </div>                                                      
                          </div>   
			  
			  :
			  
			 <RichTextEditor
			     ref={editorRef}
			     setValue={handleChange}
                             value={text}
			     people = {users}
			     placeholder={placeholder}
			     initialValue={initialVal}
			     uploadFiles = {uploadFiles}
			 />
			 }
			 {invalidPost &&
			  <Form.Text className="warningtext">
                              This field is required.
			  </Form.Text>
			 }
		     </div>
		     <div className="card-footer text-end">
			 <button onClick={(e)=>clearText(e)} className="mx-1 btn btn-outline-secondary">Cancel</button>
			 <button onClick={(e)=>submitPost(e)} data-testid="submit-post" className="btn btn-primary">Submit</button>
		     </div>
		 </Form>
	     </>
	     :
	     <div className="card-body">Assign this case before starting the discussion.</div>
	    }
        </div>
    )

}
