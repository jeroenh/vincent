import React from 'react';
import { Row, Button, Col, Dropdown, Card, DropdownButton } from 'react-bootstrap';
import '../css/casethread.css';
import { format, formatDistance } from 'date-fns'
import CaseThreadAPI from './ThreadAPI';
import { useState, useEffect } from 'react';
import DisplayLogo from "./DisplayLogo";
import DOMPurify from 'dompurify';

// Specify a configuration directive #example for custom DOMPurify                                                           
const config = {
    ADD_ATTR: ['mention-id', 'style', 'data-id'], // permit mention related attributes                                       
    ADD_TAGS: ['span', 'img', 'em', 'u', 'code'], // permit additional custom tags                                           
};


export default function SimplePost(props) {

    const [post, setPost] = useState(props.post);


    useEffect(() => {

	setPost(props.post);
	
    }, [props.post]);
    
    const sanitizeHTML = (html) => {
	return DOMPurify.sanitize(html, config);
    };
    
    return (
        <div className="search-post-result">
            <div className="line">
                <h5><span className="post-time" title={`${format(new Date(post.created), 'yyyy-MM-dd H:mm:ss ')}`}>{formatDistance(new Date(post.created), new Date(), { addSuffix: true })}</span></h5>
                {post.pinned && (
                    <div className="post-pinned fw-semibold">
                        <i className="fas fa-thumbtack"></i> Pinned Post
                    </div>
                )}
	    </div>
	    <div className="lead fw-light search-post-jump">
		<div className="jump-hover d-flex align-items-start gap-3">
		    <div>
			<i className="fas fa-angle-right me-1"></i>{post.subject}
		    </div>
		    <a href="#" onClick={(e)=>(e.preventDefault(), props.jumpToPost(post.thread_id, post.id))} className="jump-btn" title="Jump to post">Jump</a>
		</div>
	    </div>
            <div className="d-flex align-items-start mt-2 ms-3">
                <div className="author d-flex align-items-start justify-content-between">
                    {post.group ?
                        <DisplayLogo
                            name={post.group.name}
                            photo={post.group.photo}
                            color={post.group.logocolor}
                        />
                        :

                        <DisplayLogo
                            name={post.author.name}
                            photo={post.author.photo}
                            color={post.author.logocolor}
                        />
                    }

                    <div className="author_info px-3">
                        <div className="post_author ml-3">{post.author.name}</div>
                        {post.group &&
                            <div className="post_org">{post.group.name}</div>
                        }
                        {post.author_role ?
                            <span className="small text-muted">({post.author_role})</span>
                            :
                            <span className="small text-muted">User Removed</span>
                        }
                    </div>
                </div>
		<div className="postcontent">
		    <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(post.content) }} />
		</div>
            </div>

        </div>
    )
}
