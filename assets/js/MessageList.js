
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Nav, Dropdown, DropdownButton, InputGroup, CardGroup, Alert, Button, Tab, Tabs, Row, Form, Card, Col } from 'react-bootstrap';

import DisplayLogo from './DisplayLogo';

import '../css/casethread.css';
import { format, formatDistance } from 'date-fns'

import DOMPurify from 'dompurify';

// Specify a configuration directive #example for custom DOMPurify
const config = {
	ADD_ATTR: ['mention-id', 'style', 'data-id'], // permit mention related attributes
	ADD_TAGS: ['span', 'img', 'em', 'u', 'code'], // permit additional custom tags
};

const MessageList = (props) => {

	const sanitizeHTML = (html) => {
		return DOMPurify.sanitize(html, config);
	};

    return (
        <ul className="list-unstyled chat-content" title="Messages in thread">
            {props.messages.map((message, index) => {
                let msgdate = new Date(message.created);
                let timeago = formatDistance(msgdate, new Date(), { addSuffix: true });

                return (
                    <li className="d-flex align-items-start gap-2 mb-4" key={`msg-${message.id}`} id={`msg-${message.id}`}>
                        <div className="align-self-start">
                            <DisplayLogo
                                name={message.sender?.name}
                                photo={message.sender?.photo}
                                color={message.sender?.logocolor}
                            />
                        </div>
                        <Card className="w-100 mx-3">
                            <Card.Header className="d-flex justify-content-between p-3 border-bottom">
                                <p className="fw-bold mb-0">{message.sender?.name ? message.sender.name : "Unknown User"}
                                    {message.groups.length > 0 &&
                                        <span>{" "}({message.groups.map(group => group).join(', ')})</span>
                                    }
                                </p>

                                <p className="text-muted small mb-0">
                                    <i className="fas fa-clock" />{' '}{timeago}
                                </p>
                            </Card.Header>
                            <Card.Body className="pt-3">
                                <div className="mb-0" dangerouslySetInnerHTML={{ __html: sanitizeHTML(message.content) }} />
                            </Card.Body>
                        </Card>
                    </li>
                )
            })

            }
        </ul>
    )

}

export default MessageList;
