import React from 'react';
import {Row, Button, Col, Dropdown, Card, DropdownButton} from 'react-bootstrap';
import '../css/casethread.css';
import { format, formatDistance } from 'date-fns'
import PostReactions from './PostReactions';
import CaseThreadAPI from './ThreadAPI';
import { useState, useEffect } from 'react';
import Editor from "./Editor";
import DisplayLogo from "./DisplayLogo";
import DOMPurify from 'dompurify';


const threadapi = new CaseThreadAPI();

// Specify a configuration directive #example for custom DOMPurify
const config = {
    ADD_ATTR: ['mention-id', 'style', 'data-id'], // permit mention related attributes
    ADD_TAGS: ['span', 'img', 'em', 'u', 'code'], // permit additional custom tags
};


export default function PostDisplay(props) {

    const updateData = props.dataUpdated;
    const deletePost = props.deletePost;
    const replyToPost = props.replyToPost;
    const viewPostDiff = props.viewPostDiff;

    const Post = (props) => {
	const [editPost, setEditPost] = useState(false);
	const [post, setPost] = useState(props.post);
	const user = props.user;
	const date = props.date;
	const timeago = props.timeago;


	function likePost(evtKey, evt) {
	    threadapi.likePost(post, evtKey).then((response) => {
		setPost({...post, reactions:response})
	    });
	}


	const sanitizeHTML = (html) => {
            return DOMPurify.sanitize(html, config);
	};

	const editThisPost=()=> {
	    setEditPost(true);
	}

	const doneEditPost=()=> {
	    setEditPost(false);
	    threadapi.getPost(post).then((response) => {
		setPost(response);
	    });
	}

        let dprops  = {
	    user,
	    post,
	}
	let cols = props.reply ? 11 : 12;
	let cardclass = props.parent ? "has_replies" : "mt-2";
	cardclass = props.lastreply ? `${cardclass}` : `mb-2 ${cardclass}`;
	//cardclass = props.reply ? "replypost" : cardclass;
	//{user.user.photo ? <Image src={user.user.photo} rounded /> : (displayLogo(dprops)) }

	return (
	    <Row>
		{props.reply &&
		 <Col lg={1} className="me-0 pe-0">
		     <div className="replyspace h-100"></div>
		 </Col>
		}

		<Col lg={cols}>
		    <Card key={`card_${post.id}`} className={`${cardclass} ${post.pinned ? "pinned" :""} ${user.new_posts?.includes(post.id) && "card_new_post"}`}>
			<Card.Header>
			    <div className="d-flex align-items-start justify-content-between mt-2">
				<div className="author d-flex align-items-start justify-content-between">
			{post.group ?
                         <DisplayLogo
                             name={post.group.name}
                             photo={post.group.photo}
                             color ={post.group.logocolor}
                         />
			 :

			 <DisplayLogo
			     name={post.author.name}
			     photo={post.author.photo}
			     color ={post.author.logocolor}
			 />
			}
			<div className="author_info px-3">
			    <div className="post_author ml-3">{post.author.name }</div>
			    {post.group &&
			     <div className="post_org">{post.group.name}</div>
			    }
			    {post.author_role ?
			     <span className="small text-muted">({post.author_role})</span>
			     :
			     <span className="small text-muted">User Removed</span>
			    }
			</div>
				    <div className="post-stats">
					<a href="#" className="post-time" onClick={(e)=>e.preventDfefault} title={`${format(date, 'yyyy-MM-dd H:mm:ss ')}`}>{timeago}</a>
					{post.pinned && (
					    <div className="post-pinned fw-semibold">
						<i className="fas fa-thumbtack"></i> Pinned Post
					    </div>
					)}

					{post.revisions > 0 && (
					    <div>
						<a href='#' onClick={(e)=>(e.preventDefault(), viewPostDiff(post.revision_id))} className="show-diff">{post.revisions} edit{post.revisions > 1 &&"s"}</a>
					    </div>
					)}
				    </div>

		    </div>
		    <PostDropdown
			user = {user}
			post = {post}
			editPost = {editThisPost}
		    />
		</div>
	    </Card.Header>
	    <Card.Body className="pt-4 contentpost">
		<div className="postcontent">
		    {editPost ?
		     <Editor
			 post = {post}
			 dataUpdated = {doneEditPost}
			 participants = {props.participants}
		     />
		     :
		     <div dangerouslySetInnerHTML={{__html: sanitizeHTML(post.content)}} />
		    }
		</div>
	    </Card.Body>
			<Card.Footer className="d-flex flex-wrap justify-content-between align-items-center px-0 pt-0 pb-3">
			    <div className="d-flex align-items-center gap-2 px-4 pt-3">
				
				{user.role !== "observer" &&
				<Dropdown onSelect={likePost}>
				    <Dropdown.Toggle variant="light" className="post-like btn btn-icon mx-2"><i className="fas fa-thumbs-up" title="React to Post"></i>
				    </Dropdown.Toggle>
				    <Dropdown.Menu className="post-like-menu">
					<div className="d-flex justify-content-between">
					    <Dropdown.Item data-testid="thumbs-up" eventKey="like">&#128077;
					    </Dropdown.Item>
					    <Dropdown.Item eventKey="dislike">&#128078;
					    </Dropdown.Item>
					    <Dropdown.Item eventKey="smile">&#128512;
					    </Dropdown.Item>
					    <Dropdown.Item eventKey="clap">&#128079;
					    </Dropdown.Item>
					    <Dropdown.Item eventKey="watch">&#128064;
					    </Dropdown.Item>
					</div>
				    </Dropdown.Menu>
				</Dropdown>
				}
				 <PostReactions
				     reactions={post.reactions}
				     likePost={likePost}
				     disabled={user.role === "observer"}
				 />

			    </div>
			    <div className="px-4 pt-3">
				<div className="d-flex gap-4 text-end reply-button">

				    {user.role !== "observer" &&

				     <Button className="reply-to-post btn btn-sm btn-primary" onClick={()=>replyToPost(post)}>Reply</Button>
				    }
				</div>

			    </div>
			</Card.Footer>


	</Card>
		</Col>
	    </Row>
	)
    }

    const PostDropdown = (props) => {

	function handlePostSelect(evt, evtKey) {
	    switch(evt) {
	    case 'pin':
		threadapi.pinPost(props.post).then((response) => {
		    updateData();
		});
		return;

	    case 'delete':
		deletePost(props.post.id);
		return;
	    case 'edit':
		props.editPost(props.post.id);
		return;

	    case 'unpin':
                threadapi.unpinPost(props.post).then((response) => {
		    updateData();
                })
		return;
	    default:
		console.log("Not a valid option.");
	    }
	};


	const user = props.user;
	const post = props.post;

	const icon = (<i className="bx bx-dots-vertical-rounded" title="Post actions"></i>);
	const showedits = (user.contact == post.author.contact);
	const showdelete = (showedits || user.delete_perm);
	const showpin = (user.delete_perm && !post.pinned);
	const showunpin = (user.delete_perm && post.pinned);

	if (showedits || showdelete || showpin || showunpin) {
	    return (
		
		<DropdownButton variant="btn p-0 postactions" title={icon} onSelect={handlePostSelect}>
		    {showedits && (
			<Dropdown.Item eventKey="edit">Edit Post</Dropdown.Item>
		    )}
		    {showdelete && (
			<Dropdown.Item eventKey='delete'>Delete Post</Dropdown.Item>
		    )}
		    {showpin && (
			<Dropdown.Item eventKey='pin'>Pin Post</Dropdown.Item>
		    )}
		    {showunpin && (
			<Dropdown.Item eventKey='unpin'>Unpin Post</Dropdown.Item>
		    )}
		</DropdownButton>
	    );
	} else {
	    return "";
	}
    };

    const displayLogo = (props) => {
	const {user, post} = props;
	const style = {
	    backgroundColor: user.user.logocolor
	};
	return(
	    <div className="profile-pic rounded-circle text-center flex-shrink-0" style={style}>
	    <span className="logo-initial">{post.author_name[0]}</span></div>
	);
    }

    useEffect(() => {
	/**
	   if we're looking for a post because we're searching - then scroll to that post
	**/
	if (props.find) {
	    let el = document.querySelector(`#post-${props.find}`);
	    if (el) {
		el.scrollIntoView({behavior: 'smooth', block: 'center'});
	    }
	}
	
    }, [props.find]);

    const displayPosts = (props) => {
        const {user, posts} = props;

        if (posts && posts.length > 0) {
            return (
		posts.map((post, index) => {
		    //console.log(format(post.created, 'yyyy/mm/dd'));
		    let date = new Date(post.created);
		    let timeago = formatDistance(date, new Date(), {addSuffix: true});
		    return (
			<div key={`post-${post.id}`} id={`post-${post.id}`}>
			    {post.replies && post.replies.length > 0 ?
			     <>
				 <div className="replywrap">
				 <Post
				     key={post.id}
				     user={user}
				     post={post}
				     date={date}
				     timeago={timeago}
				     parent={true}
				     participants={props.participants}
				 />
			     </div>
			     <div className="p-2 replygap h-100"></div>
			     <div className="replies">
				 {post.replies.map((reply, index) => {
				     let d = new Date(reply.created);
				     let tgo = formatDistance(d, new Date(), {addSuffix: true});
				     let lastreply = (index == post.replies.length) ? true : false;
				     return (
					 <div key={`reply-${reply.id}`} id={`post-${reply.id}`}>
					     <Post
						 key={reply.id}
						 user={user}
						 post={reply}
						 date={d}
						 timeago={tgo}
						 reply={true}
						 parent={false}
						 lastreply={lastreply}
						 participants={props.participants}
					     />
					 </div>
				     )
				 })}
			     </div>
				 <div className="mb-4"></div>
			     </>
			     :
			     <Post
                                 key={post.id}
                                 user={user}
                                 post={post}
                                 date={date}
                                 timeago={timeago}
				 participants={props.participants}
                             />
			    }
			</div>
                    )

		})

            );

        } else if (props.search) {
	    return (
		<p className="text-center"> No posts matched your filter criteria.</p>
	    );
	}
    }
    return (
        <>
            {displayPosts(props)}
        </>
    )
}
