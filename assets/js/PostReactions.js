
import React from 'react';
import {Button, Badge, OverlayTrigger, Tooltip} from 'react-bootstrap';
import '../css/casethread.css';

export default function PostReactions({reactions, likePost, disabled}) {

    return (
	<>
	    {reactions?.map((reaction, index) => {
		
		switch(reaction.reaction) {
		case "smile": {
		    return (
			<OverlayTrigger
			    placement="top"
			    key={`react-${index}`}
			    overlay={<Tooltip>{reaction.users}</Tooltip>}
			>
			    <Button onClick={(e)=>likePost(reaction.reaction, e)} disabled={disabled} className="post-react" size="sm" variant="outline-primary"><span className="me-2">&#128512;</span>{reaction.count}
			</Button>
			</OverlayTrigger>
		    )
		}
		case "like": {
		    return (
			<OverlayTrigger
                            placement="top"
                            key={`react-${index}`}
                            overlay={<Tooltip>{reaction.users}</Tooltip>}
                        >  
			<Button  className="post-react" size="sm" data-testid="thumbs-up" onClick={(e)=>likePost(reaction.reaction, e)} disabled={disabled} variant="outline-primary"><span className="me-2">&#128077;</span>{reaction.count}
			</Button>
			</OverlayTrigger>
		    )
		}
		case "dislike": {
   		    return (
			<OverlayTrigger
                            placement="top"
                            key={`react-${index}`}
                            overlay={<Tooltip>{reaction.users}</Tooltip>}
                        >  
			<Button disabled={disabled} onClick={(e)=>likePost(reaction.reaction, e)} className="post-react"  size="sm" variant="outline-primary"><span className="me-2">&#128078;</span>{reaction.count}
			</Button>
			</OverlayTrigger>
		    )
		}

		case "clap": {
   		    return (
			<OverlayTrigger
                            placement="top"
                            key={`react-${index}`}
                            overlay={<Tooltip>{reaction.users}</Tooltip>}
                        >  
			<Button className="post-react"  disabled={disabled} size="sm" variant="outline-primary" onClick={(e)=>likePost(reaction.reaction, e)}><span className="me-2">&#128079;</span>{reaction.count}
			</Button>
			</OverlayTrigger>
		    )
		}
		case "watch": {
   		    return (
			<OverlayTrigger
                            placement="top"
                            key={`react-${index}`}
                            overlay={<Tooltip>{reaction.users}</Tooltip>}
                        >  
			    <Button className="post-react" disabled={disabled} onClick={(e)=>likePost(reaction.reaction, e)}  size="sm" variant="outline-primary"><span className="me-2">&#128064;</span>{reaction.count}
			</Button>
			</OverlayTrigger>
		    )
		}    

		    
		}
	    })}
	    </>
    )

}


		    
	

    
