import React, { useState, useEffect } from 'react'
import ThreadSearchForm from './ThreadSearch';
import {Card, DropdownButton, Dropdown, InputGroup, FloatingLabel, Form, Container, Alert, Row, Col, Tab, Tabs, Nav, Button} from 'react-bootstrap';
import {useParams, useNavigate, Link, useLocation} from "react-router"
import {useModalManager} from "./hooks/useModalManager";
import CaseThreadAPI from './ThreadAPI';
import PostList from './PostList';
import ErrorModal from "./ErrorModal";
import PostSearchResults from './PostSearchResults';
import ParticipantList from './ParticipantList';
import '../css/casethread.css';
import CaseDetailApp from './CaseDetailApp';
import CaseStatusApp from './CaseStatusApp';
import ThreadHeader from './ThreadHeader';
import CaseArtifactApp from './CaseArtifactApp';
import DeleteConfirmation from "./DeleteConfirmation";
import CaseActivityApp from './CaseActivityApp';
import CaseThreadSettings from './CaseThreadSettings';
import EditThreadsModal from './EditThreadsModal';

const threadapi = new CaseThreadAPI();

const CaseThreadApp = () => {

    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { openModal, closeModal, currentModal } = useModalManager();
    const [crumbs, setCrumbs] = useState(location.state?.breadcrumbs);
    const [crumbLink, setCrumbLink] = useState(location.state?.crumb_link);
    const [error, setError] = useState(null);
    const [threadError, setThreadError] = useState(null);
    const [showGroupSelection, setShowGroupSelection] = useState(false);
    const [threads, setThreads] = useState([]);
    const [threadSubject, setThreadSubject] = useState("");
    const [invalidSubject, setInvalidSubject] = useState(false);
    const [caseInfo, setCaseInfo] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [reqUser, setReqUser] = useState(null);
    const [showRemove, setShowRemove] = useState(false);
    const [searchStr, setSearchStr] = useState({value: '', toggle: 'lifo'});
    const [activeTab, setActiveTab] = useState(null);
    const [urlTab, setUrlTab] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [showNewThread, setShowNewThread] = useState(false);
    const [owners, setOwners] = useState([]);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [removeID, setRemoveID] = useState(null);
    const [showArchived, setShowArchived] = useState(false);
    const [reloadActivity, setReloadActivity] = useState(0);
    const [displayCaseThreadSettings, setDisplayCaseThreadSettings] = useState(false);
    const [newPosts, setNewPosts] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [findPost, setFindPost] = useState(null);
    const [metadata, setMetadata] = useState({});
    
    const searchThreads=(v, t) => {
	setSearchStr({value: v, toggle: t});
	if (v) {
	    setShowSearchResults(true);
	}
    }

    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
	setShowRemove(false);
    };

    const hideCaseThreadSettings = () => {
	setDisplayCaseThreadSettings(false);
    }

    const saveThreadSettings = (updated) => {

	if (showArchived) {
	    let archived = updated.filter(x => x.archived);
	    setThreads(archived);
	} else {
	    let not_archived = updated.filter(x => x.archived == false);
	    setThreads(not_archived);
	}
    }

    const submitRemoveThread = (id) => {
        threadapi.deleteThread(id).then((response) => {
	    if (showArchived) {
		getArchivedThreads();
	    } else {
		fetchInitialData();
	    }
        });
        setDisplayConfirmationModal(false);
	setShowRemove(false);
    };


    const setActiveTabNow = (props) => {
	console.log(props);
	if (props === "addTab") {
	    setShowNewThread(true);
	    setActiveTab("addTab");
	} else {
	    let thread = threads.filter(thread => thread.id==props)
	    setShowNewThread(false);
	    setActiveTab(thread[0]);
	}
    }

    const getThreadParticipants = async () => {
	if (activeTab) {
	    setIsLoading(true);
	    const thread = activeTab.id;
	    try {
		await threadapi.getThreadParticipants(thread).then((response) => {
                    setParticipants(response);
		    console.log(response);
		    setReloadActivity(reloadActivity + 1);
		    setIsLoading(false);
		})
            } catch (err) {
		console.log('Error:', err)
            }
	} else {
	    setParticipants([]);
	}
    }


    const createThread = async (event) => {
	event.preventDefault();

	const formData = new FormData(event.target),
	      formDataObj = Object.fromEntries(formData.entries());
	
	
	if (event.target.elements[0].value == "") {
	    setInvalidSubject(true);
	} else {
	    
	    await threadapi.createThread({'case': id}, formDataObj).then((response) => {
		fetchUser();
		setThreads(threads => [...threads, response]);
		setShowNewThread(false);
		setActiveTab(response);

		setThreadSubject("");
		event.target.elements[0].value = "";

            }).catch(err => {
		if (err.response?.status == 400) {
		    if (err.response?.data?.error.includes("multiple")) {
			setShowGroupSelection(true);
		    } else {
			setError(err.response.data);
			openModal("error");
		    }
		} else {
		    setError(err.response.data);
		    openModal("error");
		}

	    });
		
	    
	}
    }

    const closeTab = (thread) => {
        setRemoveID(thread.id);
	if (thread.archived) {
	    setDeleteMessage(`Are you sure you want to unarchive this thread wtih subject ${thread.subject}?`);
	} else {
            setDeleteMessage(`Are you sure you want to archive this thread with subject ${thread.subject}?`);

	}
        setDisplayConfirmationModal(true);
    }

    const getArchivedThreads = async () => {
	setShowArchived(true);
	try {
	    await threadapi.getArchivedThreads({'case':id}).then((response) => {
		console.log(response);
		if (response.length > 0) {
		    setActiveTab(response[0]);
		}
                setThreads(response);
            })
	} catch (err) {
	    if (err.response) {
		setThreadError(err.response.data.detail);
	    }else {
		setThreadError("Error retrieving archived threads");
	    }
	    
	    console.log('Error:' , err)
	}
    }


    const fetchMetadata = async () => {
	await threadapi.getCaseMetadata(id).then((response) => {
            setMetadata(response);
        }).catch (err => {
	    console.log(err);
	});
    }

    const fetchUser = async () => {

	await threadapi.getUserCaseState({'case': id}).then((response) => {
	    setReqUser(response);
	})
    }
    
    
    // Async Fetch
    const fetchInitialData = async () => {
	setShowArchived(false);
	try {
	    setReloadActivity(reloadActivity + 1);
	    await threadapi.getCase({'case': id}).then(async (response) => {
                setCaseInfo(response);	    
		setOwners(response.owners);
		fetchUser();
		await threadapi.getThreads({'case': id}).then((response) => {
		    const queryString = window.location.search;
		    const urlParams = new URLSearchParams(queryString);
		    const thread = urlParams.get('thread')
		    if (thread) {
			/* find thread */
			let findtab = response.filter((item) => item.id == thread)
			if (findtab) {
			    setActiveTab(findtab[0]);
			} else {
			    setActiveTab(response[0]);
			}
		    } else {
			setActiveTab(response[0]);
		    }
                    setThreads(response);
		})
	    }).catch(err => {
		if (err.response && (err.response.status == 403 || err.response.status==404 || err.response.status==500)) {
		    navigate("err");
		}
	    });

	} catch (err) {
	    console.log(`Error: ${err.message}`);
	}
    }

    useEffect(() => {
	fetchInitialData();

	if (id) {
	    document.title = `VINCE-NT Case#${id}`;
	}
	
    }, []);

    useEffect(() => {
	if (activeTab != "addTab") {
	    getThreadParticipants();
	} else {
	    setParticipants([]);
	}
	
    }, [activeTab]);


    const findNewThreads = () => {

	let new_thread = threads.find(x => x.last_post > reqUser.last_viewed);
	if (new_thread) {
	    setActiveTab(new_thread);
	    //scroll to bottom of posts where new posts live
	    document.querySelector("#allposts").scrollIntoView({behavior: 'smooth', block: 'end'});
	}
    }
	

    const showAddaTab = () => {

	if (activeTab === "addTab") {
	    return true;
	}

	if (reqUser.role == "observer") {
	    return false;
	}
	
	if (participants.length == 0 || showArchived) {
	    return false;
	}

	if (reqUser.role == "owner") {
	    return true;
	}

	if (reqUser.priv_thread) {
	    return false;
	}

	return true;

    }
	
    const jumpToPost = (thread_id, post_id) => {
	console.log(thread_id);
	console.log(post_id);
	setShowSearchResults(false);

	let findtab = threads.find(y => y.id == thread_id);
	if (findtab) {
	    setActiveTab(findtab);
	    setFindPost(post_id);
	}
	
    }
    

    useEffect(() => {
	if (reqUser) {
	    if (['coordinator', 'owner'].includes(reqUser.role)) {
		fetchMetadata();
	    } 
	}

    }, [reqUser]);


    const goToNewPosts = (e) => {
	if (e) {
	    e.preventDefault();
	}
	setNewPosts(false);
	let el = document.querySelector(".card_new_post");
	if (el) {
	    el.scrollIntoView({behavior: 'smooth', block: 'center'});
	} else {
	    findNewThreads();
	}
	    
    }

    const updateCaseActivity = () => {
	setReloadActivity(reloadActivity + 1);
    };
    

    return (
	<>
	    {caseInfo && reqUser ? (
		<>
		    <div className="d-flex justify-content-between align-items-center">
		    {crumbs ?

		     <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">{crumbs[0]} /</span> <Link to={crumbLink} >{crumbs[1]}</Link> / {caseInfo.case_identifier} {caseInfo.title}</h4>
		     :
		     <>
			 {caseInfo.owners.length == 0 && caseInfo.status=="Pending" ?
			  <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Triage /</span> <Link to={"/cvdp/triage/"}>Unassigned Cases</Link> /  {caseInfo.case_identifier} {caseInfo.title}</h4>    
			  :
			  <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Cases /</span> {caseInfo.case_identifier} {caseInfo.title}</h4> 
			 }
		     </>
		    }
			{['coordinator', 'owner'].includes(reqUser.role) &&
			 <Button variant="outline-primary" onClick={(e)=>navigate("dash", {state: {caseInfo: caseInfo, reqUser: reqUser}})}>Case Dashboard</Button>
			}
		    </div>
		    <Row>
			<Col lg={8} md={8} className="h-100">
			    {reqUser.new_posts?.length > 0 &&
			     <Alert dismissible variant="info">You have <a href="#" onClick={(e)=>goToNewPosts(e)}>{reqUser.new_posts.length} new posts</a> to read!</Alert>
			    }
			    
			    <CaseDetailApp
				caseInfo = {caseInfo}
				updateStatus = {fetchInitialData}
				user = {reqUser}
				updateActivity={updateCaseActivity}
				metadata={metadata}
			    />
		     
		     <Card>
			 <Card.Header as="h5" className="d-flex align-items-center justify-content-between pb-2">
			     <Card.Title className="mb-1">
				 {showArchived &&
				  "Archived "
				 }
			     Case Threads</Card.Title>
			     {
				 <DropdownButton variant="btn p-0"
						 id="thread-dropdown"
						 title={<i className="bx bx-dots-vertical-rounded" title="Case Thread Management"></i>}
			     >
				 {showArchived || reqUser.role !== "owner" ? ""
				  :
				  <>
				      <Dropdown.Item eventKey='add' onClick={(e)=>setActiveTabNow("addTab")}>Add a Thread</Dropdown.Item>
				      <Dropdown.Item eventKey='settings' onClick={(e)=>setDisplayCaseThreadSettings(true)}>Thread Settings</Dropdown.Item>

				  </>
				 }
				 {showArchived ?
				  <>
				      <Dropdown.Item eventKey='current' onClick={(e)=>(fetchInitialData())}> Show Current Threads </Dropdown.Item>
				      {reqUser.role === "owner" && threads.length > 0 &&
				       <Dropdown.Item eventKey='remove' onClick={(e)=>(openModal("editThreads"))}> Revive (Unarchive) Threads </Dropdown.Item>
				      }
				  </>
				  :
				  <>
				      <Dropdown.Item eventKey='archived' onClick={(e)=>(getArchivedThreads())}> Show Archived </Dropdown.Item>
				      {reqUser.role === "owner" && threads.length > 1 &&
				       <Dropdown.Item eventKey='remove' onClick={(e)=>(openModal("editThreads"))}> Archive Threads </Dropdown.Item>
				      }
				  </>
				 }



			     </DropdownButton>
			      }
			 </Card.Header>
			 <Card.Body>

			     <ThreadSearchForm
				 onSubmit={searchThreads}
				 value={searchStr?.value}
				 toggle={searchStr?.toggle}
			     />

			     {showSearchResults && searchStr ?

			      <PostSearchResults
				  search = {searchStr}
				  caseInfo = {caseInfo}
				  close={()=>(setSearchStr({...searchStr, value: ''}), setShowSearchResults(false))}
				  jumpToPost={jumpToPost}
			      />
			      :


			      <>
				  {threads.length > 0 && showArchived &&
				   <Alert variant="info">Archived threads are read-only</Alert>
				  }
				  
				  {threads.length == 0 ?
				   
				   <Alert variant="warning">No Threads to display</Alert>
				   : (
				       <Tab.Container
					   defaultActiveKey={threads[0].id}
					   activeKey = {activeTab == "addTab" ? "addTab" : activeTab.id}
					   className="mb-3"
					   onSelect={setActiveTabNow}
				       >
					   <Nav variant="pills" className="mb-3">
					       {
						   threads.map((thread, index) => {
						       return (
							   <Nav.Item key={index} className="thread-pill">
							       <Nav.Link eventKey={thread.id} className="text-truncate">{thread.subject}
								   {reqUser.last_viewed < thread.last_post && reqUser.new_posts.length > 0 &&
								    <span className="thread-new-posts text-nowrap">NEW!</span>
								   }
							       </Nav.Link>
							   </Nav.Item>
						       )
						   })
					       }
					       {showAddaTab() &&
						<Nav.Item>
						    <Nav.Link eventKey="addTab">
							{reqUser.role !== "owner" ?
							 <><i className="fas fa-message"></i> Contact Coordinators</>
							 :
							 <><i className="fas fa-plus"></i> Add a Thread</>
							}
						    </Nav.Link>
						</Nav.Item>
					       }
					       
					   </Nav>
					   <Tab.Content id="thread-list">
					       
					       {
						   threads.map((thread, index) => {
						       if (thread.id == activeTab.id) {
							   return (
							       <Tab.Pane eventKey={thread.id} key={index}>
								   {thread.official ? ""
								    :
								    <ThreadHeader
									thread={thread}
									user={reqUser}
									participants={participants}
									caseInfo={caseInfo}
									update={()=>(getThreadParticipants(), updateCaseActivity())}
								    />
								   }
								   
								   <PostList
								       thread = {thread}
								       user = {reqUser}
								       toggle = {searchStr?.toggle}
								       participants = {participants}
								       update = {updateCaseActivity}
								       find = {findPost}
								   />
							       </Tab.Pane>
							   )
						       }
						   })
					       }
					       
					       <Tab.Pane eventKey="addTab">
						   {reqUser.role === "owner" ?
						    <p>To start a new thread, please provide a short subject.</p>
						    :
						    <p>To start a new thread with the coordinator(s), please provide a subject.</p>
						   }
						   <Form onSubmit={(e)=>createThread(e)}>
						       <InputGroup className="mb-3">
							   <Form.Control isInvalid={invalidSubject} name="subject" placeholder="Add a subject for this new thread" />
							   <Button
							       type="submit"
							       variant="outline-primary"
							   >Create</Button>
							   <Button
							       data-testid="cancel-create-thread"
							       type="cancel"
							       variant="outline-secondary"
							       onClick={(e)=>(e.preventDefault(),setActiveTab(threads[0]),setShowNewThread(false))}>
							   Cancel</Button>
							   
						       </InputGroup>
						       {invalidSubject &&
							<Form.Text className="error">
							    This field is required.
							</Form.Text>
						       }

						       {showGroupSelection &&
							<Form.Group controlId="groupName">
							    <Form.Label>Select Group<span className="required">*</span></Form.Label>
							    <Form.Select required={true} name="group" isInvalid={true}>
								{reqUser.groups.map((x, i) => (
								    <option key={`group-${i}`} value={x.name}>{x.name}</option>
								))}
							    </Form.Select>
							</Form.Group>
						       }
						   </Form>
						   
					       </Tab.Pane>
					   </Tab.Content>
				       </Tab.Container>
				   )}
			      </>
			     }
			 </Card.Body>
		     </Card>
		 </Col>
		 <Col lg={4} md={4} className="h-100">
		     <CaseStatusApp
			 caseInfo = {caseInfo}
			 updateStatus = {fetchInitialData}
			 user = {reqUser}
			 reload = {getThreadParticipants}
			 metadata={metadata}
		     />
		     <CaseArtifactApp
			 caseInfo = {caseInfo}
			 user = {reqUser}
		     />
		     {showNewThread ?
		      <Card className="mt-4">
			  <Card.Header as="h5" className="d-flex align-items-center justify-content-between">
			      <Card.Title className="m-0">
				  Thread Participants
			      </Card.Title>
			  </Card.Header>
			  <Card.Body>
			      Create thread to add participants
			  </Card.Body>
		      </Card>
		      :
		      <>
			  {participants.length > 0 && (
			      <ParticipantList
				  participants = {participants}
				  activethread = {activeTab}
				  reload = {getThreadParticipants}
				  removeThread = {closeTab}
				  user = {reqUser}
				  caseInfo = {caseInfo}
			      />
			  )
			  }
		      </>
		     }
		     <CaseActivityApp
			 caseInfo = {caseInfo}
			 user = {reqUser}
			 reload = {reloadActivity}
		     />
		     {currentModal === "error" &&
		      <ErrorModal
			  showModal = {true}
			  hideModal = {() => closeModal()}
			  drf = {error}
		      />
		     }
		     <DeleteConfirmation
			 showModal={displayConfirmationModal}
			 confirmModal={submitRemoveThread}
			 hideModal={hideConfirmationModal}
			 id={removeID}
			 message={deleteMessage}
			 buttonText="Confirm"
		     />
		     {reqUser.role == "owner" &&
		      <>
			  {currentModal === "editThreads" &&
			   <EditThreadsModal
			       showModal = {true}
			       hideModal = {() => closeModal()}
			       threads={threads}
			       save={saveThreadSettings}
			   />
			  }

			  <CaseThreadSettings
			      showModal={displayCaseThreadSettings}
			      hideModal={hideCaseThreadSettings}
			      save={saveThreadSettings}
			      threads={threads}
			  />
		      </>
		     }
			      
		     
		 </Col>
		    </Row>
		</>
	    )
	     :
	     ""
	     
	    }
	</>
    )
    
};

export default CaseThreadApp;
