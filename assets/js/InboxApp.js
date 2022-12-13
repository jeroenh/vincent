import React, { useState, useRef, useEffect, useMemo, useContext } from "react";
import {
    Nav,
    Dropdown,
    DropdownButton,
    InputGroup,
    CardGroup,
    Alert,
    Button,
    Tab,
    Tabs,
    Row,
    Form,
    Card,
    Col,
} from "react-bootstrap";
import { Typeahead } from "react-bootstrap-typeahead";
import MessageAPI from "./MessageAPI";
import DisplayLogo from "./DisplayLogo";
import MessageThreadHeader from "./MessageThreadHeader";
import MessageList from "./MessageList";
import NewMessage from "./NewMessage";
import {useParams, useNavigate, Link, useLocation} from "react-router";
import SendMessageApp from "./SendMessageApp";
import { serializer, deserializer } from "./slatejs/utils/serializer.js";
import Messenger from "./Messenger";
import { format, formatDistance } from "date-fns";
import PerfectScrollbar from "react-perfect-scrollbar";
import "react-perfect-scrollbar/dist/css/styles.css";
import "../css/casethread.css";
import StandardPagination from "./StandardPagination";
import DOMPurify from "dompurify";
import CompContext from './CompContext';

const messageapi = new MessageAPI();

// Specify a configuration directive #example for custom DOMPurify
const config = {
    ADD_ATTR: ["mention-id", "style", "data-id"], // permit mention related attributes
    ADD_TAGS: ["span", "img", "em", "u", "code"], // permit additional custom tags
};

const initialValue = [
    {
        type: "paragraph",
        children: [{ text: "" }],
    },
];

const InboxApp = (props) => {

    const isInitialMount = useRef(true);

    const messageRef = useRef(null);
    const { id } = useParams();
    const {user, setUser, loading} = useContext(CompContext);
    const [threads, setThreads] = useState([]);
    const [messages, setMessages] = useState([]);
    const [curThread, setCurThread] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [search, setSearch] = useState(null);
    const [itemsCount, setItemsCount] = useState(0);
    const [reasons, setReasons] = useState([]);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(true);
    const [newMessage, setNewMessage] = useState(false);
    const [findMessage, setFindMessage] = useState(null);
    const [expandUsers, setExpandUsers] = useState(false);
    const [coordinator, setCoordinator] = useState(false);
    const [sendMsgContact, setSendMsgContact] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [sentMessage, setSentMessage] = useState(false);
    const [scrollBarRef, setScrollBarRef] = useState(null);
    const [fileUpload, setFileUpload] = useState(false);


    const fetchInitialData = async (msg) => {

        if (msg) {
            setFeedback(msg);
            setSentMessage(true);
        } else {
            setFeedback(null);
        }

	await messageapi
            .getThreads()
            .then((response) => {
                setThreads(response.results);
                setItemsCount(response.count);
                setIsLoading(false);
            })
            .catch((err) => {
                console.log(err);
                setError("Error retrieving threads");
            });
    }

    const sanitizeHTML = (html) => {
        return DOMPurify.sanitize(html, config);
    };

    useEffect(() => {
	console.log(currentPage);
        if (!isInitialMount.current) {
	    console.log("HEYA");
            paginationHandler(currentPage);
        }
    }, [currentPage]);

    const updateMessages = (msg) => {
        setMessages((messages) => [...messages, msg]);
    }


    const paginationHandler = async (page) => {
        await messageapi
            .getThreadsByPage(page)
            .then((response) => {
                setThreads(response.results);
                setItemsCount(response.count);
		setIsLoading(false);
            })
            .catch((err) => {
                setError(err);
            });
    }

    const searchThreads = async (sv) => {

        await messageapi.searchThreads(urlstr).then((response) => {
            setThreads(response.results);
            setItemsCount(response.count);
        }).catch(err => {
	    console.log(err);
	});
    }
	
    
    useEffect(() => {
        if (isInitialMount.current) {
            /* don't search threads on initial mount */
            isInitialMount.current = false;
        } else {

            let urlstr = "";
            if (search) {
		let t = encodeURIComponent(search)
                urlstr = `search=${t}`;
            }
	    searchThreads(urlstr);
        }
    }, [search]);

    useEffect(() => {
        if (threads.length > 0) {

            if (curThread == null && findMessage) {
                /* find thread */
                let st = threads.find((t) => t.id == findMessage);
                if (st) {
                    setCurThread(st);
                } else {
		    setError("Unable to find message");
                    setCurThread(threads[0]);
                }
                setLoadingMessages(true);
                setNewMessage(false);
            } else if (
                (curThread == null && sendMsgContact == null) ||
                feedback
            ) {
                setCurThread(threads[0]);
                setLoadingMessages(true);
                setNewMessage(false);
            }
        } else {
            setCurThread(null);
            setLoadingMessages(false);
            setNewMessage(true);
        }
    }, [threads, findMessage]);

    useEffect(() => {
        setLoadingMessages(false);
    }, [messages]);

    useEffect(() => {
	/* once user is fetched, loading will be set to false */
	if (!loading) {
            if (user.roles?.includes("coordinator")) {
		setCoordinator(true);
            }

	    if (document.getElementById('reasons')) {
		setReasons(JSON.parse(document.getElementById('reasons').textContent));
	    }
	    
            if (id === "thread") {
		if (document.getElementById('message')) {
		    try {
			var message = null;
			message = document.getElementById('message').getAttribute("val");
			let page = parseInt(document.getElementById('page').getAttribute("val"));
			if (page > 1) {
			    setCurrentPage(page);
			} else {
			    fetchInitialData();
			}
			setFindMessage(message);
		    } catch (err) {
			setError("Unable to find message");
		    }
			
		}
	    } else if (id) {
		fetchInitialData();
		console.log(id);
		setNewMessage(true);
		setSendMsgContact([id]);
            } else {
		fetchInitialData();
	    }
	}
    }, [loading]);

    useEffect(() => {
        setExpandUsers(false);
        setLoadingMessages(true);
        if (sentMessage) {
            setSentMessage(false);
        } else {
            setFeedback(null);
        }

        if (curThread) {
            /* user must have changed their mind about sending a msg */
            setSendMsgContact(null);
            setNewMessage(false);
            messageapi
                .getMessages(curThread)
                .then((response) => {
                    setMessages(response);
                })
                .catch((err) => {
                    setError("Error retrieving messages for this thread.");
                    console.log(err);
                });
            const newList = threads.map((item) => {
                if (item.id == curThread.id) {
                    let newitem = item;
                    newitem.unread = false;
                    return newitem;
                }
                return item;
            });
            setThreads(newList);
            /* update unread count */
            //props.update();
        }
    }, [curThread]);

    useEffect(() => {
        if (scrollBarRef) {
            scrollBarRef.scrollTop = scrollBarRef.scrollHeight;
        }
    }, [scrollBarRef]);


    const toggleExpandUsers = () => {
        if (expandUsers == true) {
            setExpandUsers(false);
        } else {
            setExpandUsers(true);
        }
    };

    const closeMessage = () => {
        if (sendMsgContact) {
            setCurThread(threads[0]);
            setSendMsgContact(null);
        }
        setNewMessage(false);
    };

    return isLoading ? (
        <div className="text-center">
            <div className="lds-spinner">
                <div></div>
                <div></div>
                <div></div>
            </div>
        </div>
    ) : (

	<Row className="inbox-app">
	    <Col lg={12}>
	    <div className="d-flex justify-content-between align-items-center">
		<h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Inbox /</span> {user.name}</h4>
		<Button variant="primary" title="Send a message" onClick={(e)=>setNewMessage(true)}>
                    <i className="fas fa-paper-plane me-1"></i>Send a Message
                </Button> 
	    </div>
	    </Col>
		
            <Col lg={4} md={4} sm={12}>
                <Card className="thread-messages-preview">
                    <Card.Body className="px-0">
                        <div className="d-flex justify-content-between align-items-center mb-3 px-3">
                            <Card.Title>Your messages</Card.Title>
                            <Button
                                className="btn btn-icon"
                                title="new message"
                                onClick={(e) => setNewMessage(true)}
                            >
                                <i className="far fa-edit"></i>
                            </Button>
                        </div>
                        <InputGroup className="rounded px-3">
                            <Form.Control
                                className="form-control rounded"
                                placeholder="Search"
                                type="search"
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <Button
                                type="submit"
                                title="search messages"
                                variant="outline-primary"
                            >
                                <i className="fas fa-search"></i>
                            </Button>
                        </InputGroup>
                        <ul className="list-unstyled mb-4 thread-preview-list">
                            {threads.length > 0 ? (
                                <>
                                    {threads.map((thread, inbox) => {
                                        let date = new Date(
                                            thread.last_message.created
                                        );
                                        let timeago = formatDistance(
                                            date,
                                            new Date(),
                                            { addSuffix: true }
                                        );
                                        /* find additional members in this thread (just 1 from each) */
                                        let other_users = thread.users.find(
                                            (item) =>
                                                item.name !=
                                                thread.last_message.sender?.name
                                        );
                                        let other_groups =
                                             thread.groups?.find(
                                                (item) =>
                                                    item.name !=
                                                    thread.last_message.sender
                                                        ?.name
                                             );
                                        
                                        if (other_users && other_groups) {
                                            other_users = [
                                                other_users,
                                                other_groups,
                                            ];
                                        } else if (other_groups) {
                                            other_users = [other_groups];
                                        } else if (other_users) {
                                            other_users = [other_users];
                                        } else {
                                            other_users = [];
                                        }
                                        let total_threaders =
                                            thread.users.length +
                                            thread.groups.length -
                                            1 -
                                            other_users.length;
                                        return (
                                            <li
                                                className="p-2 border-bottom"
                                                id={`inbox-${thread.id}`}
                                                key={`inbox-${thread.id}`}
                                                style={{
                                                    backgroundColor:
                                                        curThread &&
                                                        curThread.id ==
                                                            thread.id
                                                            ? "#eee"
                                                            : "inherit",
                                                }}
                                            >
                                                <a
                                                    href="#"
                                                    onClick={(e) =>
                                                        setCurThread(thread)
                                                    }
                                                    className="d-flex justify-content-between"
                                                >
                                                    <div className="d-flex flex-row gap-2">
                                                        <DisplayLogo
                                                            name={
                                                                thread
                                                                    .last_message
                                                                    .sender
                                                                    ?.name
                                                            }
                                                            photo={
                                                                thread
                                                                    .last_message
                                                                    .sender
                                                                    ?.photo
                                                            }
                                                            color={
                                                                thread
                                                                    .last_message
                                                                    .sender
                                                                    ?.logocolor
                                                            }
                                                        />
                                                        <div className="pt-1">
                                                            <p className="mb-0">
                                                                <span className="fw-bold">
                                                                    {thread
                                                                        .last_message
                                                                        .sender
                                                                        ?.name
                                                                        ? thread
                                                                              .last_message
                                                                              .sender
                                                                              ?.name
                                                                        : "Unknown User"}
                                                                </span>
                                                                {other_users.length >
                                                                    0 && (
                                                                    <>
                                                                        <span className="fw-bold">
                                                                            ,{" "}
                                                                        </span>

                                                                        {other_users.map(
                                                                            (
                                                                                item,
                                                                                index
                                                                            ) => {
                                                                                return (
                                                                                    <span
                                                                                        className="fw-bold"
                                                                                        key={`${thread.id}-${index}`}
                                                                                    >
                                                                                        {
                                                                                            item?.name
                                                                                        }
                                                                                        {index +
                                                                                            1 <
                                                                                            other_users.length &&
                                                                                            ", "}
                                                                                    </span>
                                                                                );
                                                                            }
                                                                        )}
                                                                    </>
                                                                )}
                                                                {total_threaders >
                                                                    0 && (
                                                                    <span className="fw-bold">
                                                                        {" "}
                                                                        +
                                                                        {
                                                                            total_threaders
                                                                        }{" "}
                                                                    </span>
                                                                )}
                                                                <small>
                                                                    {" "}
                                                                    (
                                                                    {
                                                                        thread
                                                                            .message_count
                                                                    }
                                                                    )
                                                                </small>
                                                            </p>
                                                            <div
                                                                className={
                                                                    curThread &&
                                                                    curThread.id ==
                                                                        thread.id
                                                                        ? "small text-break"
                                                                        : "small text-muted text-break"
                                                                }
                                                                dangerouslySetInnerHTML={{
                                                                    __html: sanitizeHTML(
                                                                        thread.last_message.content
                                                                            .trim()
                                                                            .substring(
                                                                                0,
                                                                                50
                                                                            )
                                                                    ),
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="pt-1 text-end">
                                                        <p
                                                            className={
                                                                curThread &&
                                                                curThread.id ==
                                                                    thread.id
                                                                    ? "small mb-1"
                                                                    : "small text-muted mb-1"
                                                            }
                                                        >
                                                            {timeago}
                                                        </p>
                                                        {thread.unread && (
                                                            <span className="badge bg-danger float-end">
                                                                1
                                                            </span>
                                                        )}
                                                    </div>
                                                </a>
                                            </li>
                                        );
                                    })}
                                </>
                            ) : (
                                <li className="p-2 border-bottom text-center lead">
                                    No threads available
                                </li>
                            )}
                        </ul>
                        <div className="inbox-pagination w-100">
                            {itemsCount > 0 && (
                                <StandardPagination
                                    itemsCount={itemsCount}
                                    itemsPerPage="10"
                                    currentPage={currentPage}
                                    setCurrentPage={setCurrentPage}
                                />
                            )}
                        </div>
                    </Card.Body>
                </Card>
            </Col>
            <Col lg={8} md={8} sm={12} className="thread-messages">
                {feedback && <Alert variant="success">{feedback}</Alert>}
                {newMessage ? (
                    <NewMessage
                        cancelMessage={closeMessage}
                        coordinator={coordinator}
                        reload={fetchInitialData}
                        sendContact={sendMsgContact}
                        group={props.group?.uuid}
			reasons={reasons}
                    />
                ) : (
                    <>
                        {error && <Alert variant="danger"> {error}</Alert>}
                        {loadingMessages ? (
                            <div className="text-center">
                                <div className="lds-spinner">
                                    <div></div>
                                    <div></div>
                                    <div></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {curThread ? (
                                    <>
                                        <MessageThreadHeader
                                            thread={curThread}
                                        />

                                        <PerfectScrollbar
                                            style={{
                                                position: "relative",
                                                height: "auto",
                                            }}
                                            className="chat-scrollbar mb-1"
                                            containerRef={setScrollBarRef}
                                            title="Scroll Thread Messages"
                                        >
                                            <MessageList messages={messages} />
                                        </PerfectScrollbar>
					
					<SendMessageApp
					    thread={curThread.id}
					    messageSent={updateMessages}
					/>
                                        
                                    </>
                                ) : (
                                    <p>No messages here...</p>
                                )}
                            </>
                        )}
                    </>
                )}
            </Col>
        </Row>
    );
};

export default InboxApp;
