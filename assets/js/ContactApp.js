import React, { useState, useEffect, useMemo } from 'react';
import {Row, Table, Alert, Card, Col, ListGroup, Button, Form, Dropdown, Tab, Nav, InputGroup, DropdownButton} from 'react-bootstrap';
import ContactAPI from './ContactAPI';
import CaseList from './CaseList.js'
import Image from 'react-bootstrap/Image'
import '../css/casethread.css';
import ActivityApp from './ActivityApp.js';
import {useParams, useNavigate, Link, useLocation} from "react-router";
import InfiniteScroll from 'react-infinite-scroll-component';
import DeleteConfirmation from "./DeleteConfirmation.js";

const contactapi = new ContactAPI();

const ContactApp = (props) => {

    const [error, setError] = useState();
    const [loading, setLoading] = useState(true);
    const [cases, setCases] = useState([]);
    const [contactInfo, setContactInfo] = useState(null);
    const [activeTab, setActiveTab] = useState("detail")
    const [contact, setContact] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsCount, setItemsCount] = useState(0);
    const [activity, setActivity] = useState([]);
    const [activityHasMore, setActivityHasMore] = useState(false);
    const [activityNext, setActivityNext] = useState(null);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const { id } = useParams();

    const fetchCases = async() => {
        try {
            await contactapi.getContactCases(id).then((response) => {
                setCases(response.results);
                setItemsCount(response.count);
                setLoading(false);
            })

	    await contactapi.getContactCaseActivity(id).then((response) => {
                setActivity(response.results);
		if (response.next) {
		    setActivityHasMore(true);
		    setActivityNext(response.next);
		} else {
		    setActivityHasMore(false);
		}
            })
        } catch(err) {
            console.log('Error: ', err);
            setError(err.response.data.message);
        }
    }


    const lookupContact = async(contact) => {

        await contactapi.getContact(id).then((response) => {
	    setLoading(false);
	    console.log(response.data);
	    setContact(response.data);
        }).catch(err => {
            setError("Contact not found.");
	    setLoading(false);
            console.log(err);
        });

	await contactapi.getContactDetail(id).then((response) => {
	    setContactInfo(response);
	}).catch(err => {
	    setError("Contact not found.");
	    console.log(err);
	});
	    
    }

    const submitRemoveContact = async () => {

	hideConfirmationModal();
	await contactapi.deleteContact(id).then((response) => {
	    window.location.href='/cvdp/groups/';
	}).catch(err => {
	    setError(`Unable to remove contact: ${err.message}`);
	    console.log(err);
	})
    }
    
    
    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    };

    const fetchMoreActivity = async (page) => {
        try {
            await contactapi.getContactCaseActivity(id, activityNext).then((response) => {
		setActivity(activity.concat(response.results));
		setActivityNext(response.next);
		if (response.next) {
                    setActivityHasMore(true);
		} else {
                    setActivityHasMore(false);
		}
	    })
        } catch(err) {
            console.log(err);
            setError("Error fetching more activity");
        }
    }


    const confirmRemoveContact = () => {
	setDisplayConfirmationModal(true);
    }

    	
    
    useEffect(() => {
	if (activeTab == "cases") {
	    fetchCases();
	}
    }, [activeTab]);
    
    const goToCase = (url) => {
        window.location.href=url;
    };

    useEffect(() => {
	if (id) {
	    lookupContact();
	}
    }, [])


    useEffect(() => {
	if (contact) {
            document.title = `VINCE-NT Contact ${contact.name}`;
	}
    }, [contact]);
    
    return (
	loading ?
	    <div className="text-center">                                                                                            
                <div className="lds-spinner">                                                                                        
                    <div></div>                                                                                                      
                    <div></div>                                                                                                      
                    <div></div>                                                                                                      
                </div>                                                                                                               
            </div>  
	    :

	<>
            {id &&
             <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Contacts /</span> <Link to="/cvdp/groups/">Search</Link> /
	     Contact Detail</h4>
            }

	    {error &&
             <Alert variant="danger">{error}</Alert>
            }

	    {contact &&

	     <Tab.Container
                 defaultActiveKey="detail"
                 activeKey = {activeTab}
                 className="mb-3"
                 onSelect={setActiveTab}
             >
		 <Nav variant="pills" className="mb-3">
                     <Nav.Item key="detail">
                         <Nav.Link eventKey="detail"><i className="bx bx-user me-1"></i>{" "}Account Detail</Nav.Link>
                     </Nav.Item>
		     <Nav.Item key="cases">
                         <Nav.Link eventKey="cases"><i className="fas fa-briefcase"></i>{" "} Cases</Nav.Link>
                     </Nav.Item>
		 </Nav>
		 <Tab.Content id="admin-fns" className="p-0">
                     <Tab.Pane eventKey="detail" key="detail">
			  {contact &&
                            <Card className="mb-4">
                                <Card.Header as="h5" className="border-bottom mb-4">
                                    <div className="d-flex justify-content-between">
                                        <div className="d-flex align-items-center gap-1">
                                            {contact.user ?
					     <>
						 {contact.user.photo ?
						  <Image className="large-profile rounded-circle" src={contact.user.photo} rounded />
						  :
						  <>
                                                      <div className="d-block rounded large-profile rounded-circle text-center flex-shrink-0" style={{backgroundColor: contact.user.logocolor}}>
                                                      <span className="logo-initial">{contact.user.name ? contact.user.name[0] : contact.email[0]}</span></div>
						  </>
						 }

						 <h3 className="px-3">
                                                     {contact.user.name ? contact.user.name : contact.email}
						 </h3>

						 <Button href={`/cvdp/inbox/${contact.uuid}`}><i className="fas fa-comment" title="message user"></i> Message User
						 </Button>

					     </>
					     :
					     <h3>{contact.email}</h3>
					    }

					</div>
				    </div>
				</Card.Header>
				<Card.Body>
				    {contact.user && contactInfo ?
				     <div dangerouslySetInnerHTML={{__html: contactInfo}} />
				     :
				     <>
					 <div>
					     <Button variant="danger" size="sm" className="mb-3" onClick={(e)=> confirmRemoveContact()}>Remove Contact</Button>
					 </div>
					 <div>
					     {contact.name &&
					      <>
						  <b>Name: </b> { contact.name }<br/>
					      </>
					     }
					     {contact.email &&
					      <>
						  <b>Email:</b> {contact.email}<br/>
					      </>
					     }
					     {contact.phone &&
					      <>
						  <b>Phone:</b>   {contact.phone}<br/>
					      </>
					     }
					     <b>Associations:</b>   <br/>
					     <ul>
						 {contact.associations?.map((a, index) => (
						     
						     <li>Added to <a href="{% url 'cvdp:group' a.group.groupprofile.uuid %}">{ a.group.name }</a> on { a.created} {a.verified ? `VERIFIED` : `NOT VERIFIED`}</li>
						 ))}
					     </ul>

					 </div>
				     </>
				    }
				</Card.Body>
			    </Card>
				}
			    </Tab.Pane>
			 <Tab.Pane eventKey="cases" key="cases">
			     <Row>
				 <Col lg={8}>
				     <Card>
					 <Card.Header as="h5">
			    <Card.Title>Cases</Card.Title>
			</Card.Header>
			<Card.Body>
			    {loading ?
			     <div className="text-center">
				 <div className="lds-spinner"><div></div><div></div><div></div></div>
			 </div>
			     :
			     <CaseList
				 cases={cases}
				 count={itemsCount}
				 page = {currentPage}
				 setCurrentPage={setCurrentPage}
				 emptymessage="This contact is not participating in any cases."
			     />
			    }
			</Card.Body>
		    </Card>
				 </Col>
				 <DeleteConfirmation
                                     showModal={displayConfirmationModal}
                                     confirmModal={submitRemoveContact}
                                     hideModal={hideConfirmationModal}
                                     id={id}
                                     message={"Are you sure you want to remove this contact?"} />    

				 <Col lg={4}>
		    <Card className="card-max-height">
			<Card.Header as="h5">
			    <Card.Title>Activity</Card.Title>
			</Card.Header>
			<Card.Body>
			    <div id="scrollableDiv">
				<InfiniteScroll
                                    dataLength={activity.length}
                                    next={fetchMoreActivity}
                                    hasMore={activityHasMore}
                                    loader={<div className="text-center"><div className="lds-spinner"><div></div><div></div><div></div></div></div>}
                                    endMessage={<div className="text-center">No more activity updates</div>}
                                    scrollableTarget="scrollableDiv"
				>

                                    <ListGroup variant="flush">
					{activity.map((a, index) => {
                                            return (
						<ListGroup.Item action onClick={(e)=>goToCase(a.url)} className="p-2 border-bottom" key={`activity-${index}`}>
                                                    <ActivityApp
							activity = {a}
                                                    />
						</ListGroup.Item>
                                            )
					})}
                                    </ListGroup>
				</InfiniteScroll>
                            </div>
			</Card.Body>
		    </Card>
		</Col>
			 </Row>
		     </Tab.Pane>
		 </Tab.Content>
	     </Tab.Container>
	    }
	</>

    )
}

export default ContactApp;
