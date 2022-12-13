import React, { useState, useEffect, useMemo } from 'react';
import {useParams, useNavigate, Link, useLocation} from "react-router";
import {Row, Container, Badge, Stack, Toast, Table, Alert, Card, Col, ListGroup, Button, Form, Dropdown, Tab, Nav, DropdownButton} from 'react-bootstrap';
import InfiniteScroll from 'react-infinite-scroll-component'
import ActivityApp from './ActivityApp.js';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import Image from 'react-bootstrap/Image'
import { format, formatDistance } from 'date-fns'
import GroupAdminTable from "./GroupAdminTable";
import CasePermissionApp from "./CasePermissionApp";
import ComponentTable from './ComponentTable';
import DisplayLogo from "./DisplayLogo";
import '../css/casethread.css';
import ContactAPI from './ContactAPI';
import CaseList from './CaseList.js';
import DeleteConfirmation from './DeleteConfirmation';
import AddContactModal from './AddContactModal';
import GroupContactApp from './GroupContactApp';
import TagModal from './TagModal';

const contactapi = new ContactAPI();

const GroupAdminApp = () => {

    const { id } = useParams();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const [apiError, setApiError] = useState(false);
    const [apiKey, setApiKey] = useState(null);
    const [user, setUser] = useState(null);
    const [keys, setKeys] = useState([]);
    const [activeTab, setActiveTab] = useState(searchParams.get('activeTab') || "group");
    const [groups, setGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [contacts, setContacts] = useState([]);
    const [unverifiedContacts, setUnverifiedContacts] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [permType, setPermType] = useState("all");
    const [removeAPI, setRemoveAPI] = useState(false);
    const [refreshAPI, setRefreshAPI] = useState(false);
    const [removeID, setRemoveID] = useState([]);
    const [removeGroup, setRemoveGroup] = useState(false);
    const [addContactModal, setAddContactModal] = useState(false);
    const [editContact, setEditContact] = useState(null);
    const [tableLoading, setTableLoading] = useState(false);
    const [update, setUpdate] = useState(false);
    const [unverifiedTableLoading, setUnverifiedTableLoading] = useState(false);
    const [unverifiedUpdate, setUnverifiedUpdate] = useState(false);
    const [activity, setActivity] = useState([]);
    const [activityHasMore, setActivityHasMore] = useState(false);
    const [activityNext, setActivityNext] = useState(null);
    const [activityLoading, setActivityLoading] = useState(true);
    const [admin, setAdmin] = useState([]);
    const [groupAdmin, setGroupAdmin] = useState(false);
    const [cases, setCases] = useState([]);
    const [casesLoading, setCasesLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsCount, setItemsCount] = useState(0);
    const [displayTagModal, setDisplayTagModal] = useState(false);
    const [tableState, setTableState] = useState(["ga_name"]);
    const [showToast, setShowToast] = useState({
        show: false,
        msg: "",
        type: "",
    });

    const IndeterminateCheckbox = React.forwardRef(
	({ indeterminate, ...rest }, ref) => {
	    const defaultRef = React.useRef()
	    const resolvedRef = ref || defaultRef

	    React.useEffect(() => {
		resolvedRef.current.indeterminate = indeterminate
	    }, [resolvedRef, indeterminate])

	    return (
		<>
		    <input type="checkbox" ref={resolvedRef} {...rest} />
		</>
	    )
	}
    )

    const hideTagModal = () => {
        setDisplayTagModal(false);
    }

    const columns = useMemo(
	() => [
            {
                id: "selection",
                // The header can use the table's getToggleAllRowsSelectedProps method
                // to render a checkbox
                Header: ({ getToggleAllRowsSelectedProps }) => (
                    <div>
                        <IndeterminateCheckbox {...getToggleAllRowsSelectedProps()} />
                    </div>
                ),
                // The cell can use the individual row's getToggleRowSelectedProps method
                // to the render a checkbox
                Cell: ({ row }) => (
                    <div>
                        <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} />
                    </div>
                )
            },
            {
                Header: 'name',
                accessor: 'contact.name',
		id: 'ga_name',
		Cell: props => (
		    <Link to={`/cvdp/contact/${props.row.original.contact.uuid}/`}>{props.row.original.contact.name}</Link>
		)
            },
	    {
		Header: 'name',
                accessor: 'contact.name',
		id: "name"
	    },
	    {
		Header: 'email',
		accessor: 'contact.email'
	    },
	    {
		Header: 'phone',
		accessor: 'contact.phone'
	    },
	    {
		Header: 'user',
		accessor: 'contact.user_name'
	    },
	    {
		Header: 'admin',
		accessor: d => {return d.group_admin ? <OverlayTrigger overlay={<Tooltip>This user is a group admin</Tooltip>}><i className="fas fa-crown"></i></OverlayTrigger> : "" },
	    },
	    {
		Header: 'perms',
		accessor: 'action',
		id: 'perms',
		Cell: props => (
		    <div className="text-nowrap">
			{props.row.original.group_admin ?
			 <OverlayTrigger overlay={<Tooltip>Remove Admin Permissions</Tooltip>}><Button variant="btn-icon px-1" title="Remove admin permissions" onClick={() => changePerms(props, )}>
												   <i className="fas fa-ban"></i>
											       </Button></OverlayTrigger>
			 :
			 <OverlayTrigger overlay={<Tooltip>Make Group Admin</Tooltip>}><Button variant="btn-icon px-1" title="Make group admin" onClick={() => changePerms(props)}>
											   <i className="fas fa-crown"></i>
										       </Button></OverlayTrigger>
			}
		    </div>
		)
	    },

	], []
    );

    const unverified_columns =  useMemo(
        () => [
            {
                Header: 'name',
                accessor: 'contact.name',
		Cell: props => (
                    <Link to={`/cvdp/contact/${props.row.original.contact.uuid}/`}>{props.row.original.contact.name}</Link>
                )
            },
            {
                Header: 'email',
                accessor: 'contact.email'
            },
            {
                Header: 'phone',
                accessor: 'contact.phone'
            },
            {
                Header: 'user',
                accessor: 'contact.user_name'
            },
	    {
                Header: 'Action',
                accessor: 'action',
                Cell: props => (
                    <div className="text-nowrap d-flex gap-2">
                        <Button variant="primary" size="sm" title="Verify" onClick={() => verifyUser(props, )}>
			    Verify
                        </Button>
                        <Button variant="danger" size="sm" title="Remove Unverified User" onClick={() => removeUnverifiedUser(props)}>
			    Remove
			</Button>
		    </div>
		)
            },
        ], []
    );


    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
	setRemoveAPI(false);
	setRemoveGroup(false);
    };

    const generateNewColor = async () => {
	var randomColor = Math.floor(Math.random()*16777215).toString(16);
	let data = {'logocolor': '#'+randomColor};
	setShowToast({show:false, type:"save"});
	contactapi.updateMyGroup(selectedGroup.uuid, data).then(response => {
	    /* todo - just modify group in place */
	    fetchInitialData();
	    fetchActivity();
	}). catch(err => {
	    setApiError(`Error generating new color: ${err.message}`);
	});
    };

    const verifyUser = async (contact) => {
	let data = {'verified': true};
	setShowToast({show:false, type:"save"});
	contactapi.updateGroupContact(contact.row.original.id, data).then(response=> {
            setUnverifiedUpdate(true);
	    setUpdate(true);
        }).catch(err => {
            setApiError(`Error verifying user: ${err.response.data.detail}`);
        });
    };


    const unverifyUsers = async () => {
        let data = {'verified': false};
        setShowToast({show:false, type:"save"});
	
	selectedRows.forEach(x => {
            contactapi.updateGroupContact(x.original.id, data).then(response=> {
		setUnverifiedUpdate(true);
		setUpdate(true);
            }).catch(err => {
		setApiError(`Error unverifying user: ${err.response.data.detail}`);
            });
	});
    };

    function compareTags(a, b) {
	if (a.length !== b.length) {
	    return false;
	}

	return a.every((element, index) => {
	    return element === b[index];
	});
    }
    
    const saveTags = async (tags) => {

	if (!compareTags(tags, selectedGroup.tags)) { 
	    const formDataObj = {};
            formDataObj['tags'] = tags.map(t => t.tag);
	    
            await contactapi.updateTags(selectedGroup.uuid, formDataObj['tags']).then((response) => {
		hideTagModal();
		fetchInitialData();
		fetchActivity();
            }).catch(err => {
		hideTagModal();
		setApiError(`Error adding tags: ${err.response.data.detail}`);
            })
	} else {
	    hideTagModal();
	}

    }


    const removeUnverifiedUser = async (contact) => {
	const rmnames = [contact.row.original.contact.name];
	setShowToast({show:false, type:"save"});
	setRemoveID([contact.row.original.id]);
        setDeleteMessage(`Are you sure you want to remove the following contacts: ${rmnames}?`);
        setDisplayConfirmationModal(true);
    };



    const changePerms = async (contact) => {
	let data = {};

	setShowToast({show:false, type:"save"});
	setApiError(null);
	
	if (contact.row.original.group_admin) {
	    data = {'group_admin': false}
	} else {
	    data = {'group_admin': true}
	}
	contactapi.updateGroupContact(contact.row.original.id, data).then(response=> {
	    setShowToast({
                show: true,
                msg: "Got it! Your changes have been saved!",
                type: "success",
            });
	    setUpdate(true);
	}).catch(err => {
	    setApiError(`Error changing user permissions: ${err.response.data.detail}`);
	});
    };

    const resetImage = async () => {
        let data = {'logo': 'reset'};
	setShowToast({show:false, type:"save"});
        contactapi.updateMyGroup(selectedGroup.uuid, data).then(response => {
            /* todo - just modify group in place */

            fetchInitialData();
	    fetchActivity();
        }). catch(err => {
            setApiError(`Error removing logo: ${err.message}`);
        });
    };

    const addLogo = async(e) => {
	let formData = new FormData();
	setShowToast({show:false, type:"save"});
	formData.append('logo', e.target.files[0]);
        contactapi.updateMyGroup(selectedGroup.uuid, formData).then(response => {
            /* todo - just modify group in place */
            fetchInitialData();
	    fetchActivity();
        }). catch(err => {
            setApiError(`Error adding logo: ${err.message}`);
        });
    };


    const showDeleteGroupModal = () => {

	if (selectedRows.length > 0) {
	    setDeleteMessage("Please de-select users before attemtping to remove the group");
	} else {
	    setDeleteMessage("Are you sure you want to delete this group? This cannot be undone.");
	    setRemoveGroup(true);
	    setRemoveID(selectedGroup.uuid);
	}
        setDisplayConfirmationModal(true);
    }


    const changePermType = (e) => {
	// Destructuring                                                                    
        const { value, checked } = e.target;
    };



    const showDeleteModal = () => {
        /*get selected rows and add them to removeid */
        let rmids = [];
        let rmnames = [];
	setShowToast({show:false, type:"save"});

        selectedRows.map(item => {
            rmids.push(item.original.id)
	    if (item.original.contact.name) {
		rmnames.push(item.original.contact.name)
	    } else {
		rmnames.push(item.original.contact.email)
	    }
        });
        if (rmnames.length > 0) {
            setRemoveID(rmids);
            setDeleteMessage(`Are you sure you want to remove the following contacts: ${rmnames.join(', ')}?`);
        } else {
            setDeleteMessage("Please select a contact to remove.");
        }
        setDisplayConfirmationModal(true);
    };


    const confirmRemoveAPI = (api) => {
	setRemoveID(api.last_four);
	setRemoveAPI(true);
	setDeleteMessage(`Are you sure you want to remove API key ***${api.last_four}?`);
        setDisplayConfirmationModal(true);
    }

    const confirmRefresh = (api) => {
	setRemoveID(api.last_four);
        setRefreshAPI(true);
	setDeleteMessage(`Are you sure you want to replace API key ***${api.last_four}? A new API key will be generated.`);
        setDisplayConfirmationModal(true);
    }



    const submitRemoveContact = () => {
	if (removeAPI) {
	    contactapi.removeAPIKey(selectedGroup.uuid, removeID).then((reponse) => {
		setApiKey(null);
		fetchAPIKeys();
	    })
		.catch(err=> {
		    setApiError(`Error removing API Key: ${err.message}`);
		})
	} else if (refreshAPI) {
	    contactapi.refreshAPIKey(selectedGroup.uuid, removeID).then((response) => {

		setApiKey(response.data.key);
		fetchAPIKeys();
	    })
	        .catch(err=> {
		    setApiError(`Error refreshing API Key: ${err.message}`);
		})
	} else if (removeGroup) {
	    setRemoveGroup(false);
	    contactapi.removeGroup(id).then((response) => {
		window.location.href='/cvdp/groups/';
	    })
		.catch(err=>{
		    setApiError(`Error deleting group: ${err.message}`);
		});

	} else {
            contactapi.removeGroupContact(removeID).then((response) => {
		fetchInitialData();
            })
		.catch(err => {
		    setApiError(`Error removing contact: ${err.message}`);
		});
	}
	setRemoveAPI(false);
	setRefreshAPI(false);
	setDisplayConfirmationModal(false);
    }

    const createAPIKey = async () => {
	await contactapi.createAPIKey(selectedGroup.uuid).then((response) => {
	    setApiKey(response.data.key)
	    fetchAPIKeys();
	    fetchActivity();
	})
	    .catch(err=> {
		setApiError(`Error creating API key: ${err.message}`);
	    });
    };

    const fetchAPIKeys = async () => {
	await contactapi.getAPIKeys(selectedGroup.uuid).then((response) => {
            setKeys(response.data)
        })
            .catch(err=> {
                setApiError(`Error fetching API key: ${err.message}`);
            });
    };


    useEffect(() => {
	/* once selectedGroup is set, then data is pulled into contacts table */
	if (selectedGroup) {
	    setShowToast({show:false, type:"save"});
	    setUpdate(true);
            setUnverifiedUpdate(true);
	    fetchAPIKeys();
	    if (id || admin.includes(selectedGroup.uuid)){
		setGroupAdmin(true);
		if (id) {
		    /* allow coord user to see link to contacts page */
		    setTableState(["name"]);
		} else {
		    setTableState(["ga_name"])
		}
	    } else {
		setGroupAdmin(false);
		setTableState(["selection", "perms", "ga_name"])
	    }

	    if (id)	{
		document.title = `VINCE-NT Group ${selectedGroup.name}`;
	    }
	}

    }, [selectedGroup]);

    useEffect(() => {
	/* once contact information is updated, then add activity */

	if (selectedGroup) {
	    fetchActivity();
	}

    }, [contacts]);

    const fetchContacts = React.useCallback(({group, api}) => {

	setTableLoading(true);
	setUpdate(false);
	api.getGroupContacts(group.uuid).then((response) => {
	    setContacts(response);
	    setTableLoading(false);
	}).catch(err => {
	    console.log(err);
	    setApiError(`Error retrieving group contacts: ${err.message}`);
	});

    }, []);

    const fetchUnverifiedContacts = React.useCallback(({group, api}) => {
        setUnverifiedTableLoading(true);
        setUnverifiedUpdate(false);
        api.getUnverifiedContacts(group.uuid).then((response) => {
	    setUnverifiedContacts(response);
	    setUnverifiedTableLoading(false);
        })
	    .catch(err => {
                console.log(err);
                setApiError(`Error retrieving unverified users: ${err.message}`);
	    });

    }, []);

    const renderCopyTooltip = (props) => (
	<Tooltip id="copy-tooltip" {...props}>
	    Click to copy to clipboard
	</Tooltip>
    );

    const fetchGroupData = async () => {
	/* this function retrieves selected group */

	setApiError(null);
	try {
            contactapi.getGroup(id).then((response) => {
		console.log("GETTING GROUP!")
		console.log(response);
                setGroups([response.data]);
                setIsLoading(false);
		if (response.data?.group) {
                    setSelectedGroup(response.data.group);
		    if (response.data.group.permissions) {
			setPermType("select");
		    } else {
			setPermType("all");
		    }
		}
            });
        } catch (err) {
            setApiError(err);
        }
    };

    const fetchInitialData = async () => {
	/* this function retrieves either group with id passed by router or my groups */
	/* and sets selectedGroup (the first one) if it's not already set */

	if (id) {
	    fetchGroupData();
	    return;
	}
	setApiError(null);
        try {
            contactapi.getMyGroups().then((response) => {
		console.log(response)
                setGroups(response);
		setIsLoading(false);
		if (selectedGroup) {
		    let newgroup = response.filter(g => g.uuid==selectedGroup.uuid);
		    if (newgroup.length > 0) {
			setSelectedGroup(newgroup[0])
			if (newgroup[0].permissions) {
                            setPermType("select");
			} else {
                            setPermType("all");
			}
		    }
		} else if (response.length > 0 ) {
                    setSelectedGroup(response[0]);
		    if (response[0].permissions) {
                        setPermType("select");
                    } else {
                        setPermType("all");
                    }
                }
            });
        } catch (err) {
	    setIsLoading(false);
            setApiError(err);
        }
    };

    function handleManage(evt, evtKey) {
        switch(evt) {
        case 'add' :
	    setEditContact(null);
	    setAddContactModal(true);
            return;
	case 'edit':
	    if (selectedRows.length ==  1) {
		setEditContact(selectedRows[0].original);
		setAddContactModal(true);
	    } else if (selectedRows.length == 0 || selectedRows.length > 1) {
		setDeleteMessage("Please select a single contact to edit.");
                setDisplayConfirmationModal(true);
	    }
	    return;
        case 'remove':
	    showDeleteModal();
            return;
	case 'message':
	    if (selectedGroup) {
		let sgroupuuid = selectedGroup.uuid;
		window.location.href=`/cvdp/inbox/${sgroupuuid}/`;
	    }
	    return;
	case 'activate':
	    contactapi.activateGroup(id).then((response) => {
		fetchGroupData(id);
	    });
	    return;
	case 'deactivate':
	    contactapi.deactivateGroup(id).then((response) => {
		fetchGroupData(id);
	    });
	    return;
	case 'delete':
	    showDeleteGroupModal();
	    return;
	case 'tag':
	    setDisplayTagModal(true);
	    return;
	case 'unverify':
	    unverifyUsers();
	    return;
	default:
	    return;
	}
    };

    const fetchActivity = async () => {
	try {
	    let results = await contactapi.getGroupActivity(selectedGroup.uuid);
            let data = await results.data;

	    if (data?.results) {
		setActivity(data.results);
	    }
	    if (data) {
		setActivityNext(data.next);
		if (data.next) {
                    setActivityHasMore(true);
		}
	    }
            setActivityLoading(false);
        } catch(err) {
	    if (err.response?.data?.message) {
		setApiError(err.response.data.message);
	    } else {
		console.log(err);
		setApiError("Error retrieving group activity");
	    }
        }
    };

    const fetchMoreActivity = async (page) => {
        try {
            let results = await contactapi.getGroupActivity(selectedGroup.uuid, activityNext);
            let data = await results.data;
            setActivity(activity.concat(data.results));
            setActivityNext(data.next);
            if (data.next) {
                setActivityHasMore(true);
            } else {
                setActivityHasMore(false);
            }
        } catch(err) {
            console.log(err);
            setApiError("Error fetching more activity");
        }
    }

    const fetchCases = async() => {
	try {
	    setCasesLoading(true);
	    await contactapi.getGroupCases(selectedGroup.uuid).then((response) => {
		setCases(response.results);
		setItemsCount(response.count);
		setCasesLoading(false);
	    })
	} catch(err) {
	    console.log('Error: ', err);
	    setApiError(err.response.data.message);
	}
    }

    useEffect(() => {
	setShowToast({show:false, type:"success"});
	if (activeTab == "cases") {
	    fetchCases();
	}
    }, [activeTab])

    const hideContactModal = () => {
	setAddContactModal(false);
	setEditContact(null);
	if (id) {
	    fetchGroupData();
	} else {
	    fetchInitialData();
	}
    }


    const setActiveTabNow = (props) => {
        window.history.pushState({}, '', `?activeTab=${props}`);
        setActiveTab(props);
    }


    const updatePermScheme = async (p) => {
	let data = {'permissions': "True"}

	if (p == 'all') {
	    data = {'permissions': "False"}
	}
	
	await contactapi.updateMyGroup(selectedGroup.uuid, data).then(response => {
	}).catch(err => {
	    console.log("something happened");
	});

    }
    
    useEffect(() => {
	/* this only fires when app is initialized */
	if (id) {
	    setGroupAdmin(true);
	    fetchGroupData();

	} else {
	    const admin_groups = JSON.parse(document.getElementById('admin').textContent);
	    setAdmin(admin_groups);
            fetchInitialData();
	}

    }, []);

    function noSelect(rows) {
    }

    function handleSelectedRows(rows) {
        setSelectedRows(rows);
    }

    function makeSelect(e) {
	setApiError(null);
	let newgroup = groups.filter((acc) => acc.uuid == e.target.value);
        if (newgroup.length > 0) {
            setSelectedGroup(newgroup[0]);
        }
    }

    return (

	isLoading ?
	    <Row>
		<Col lg="12">
		    <div className="text-center">
			<div className="lds-spinner"><div></div><div></div><div></div></div>
		    </div>
		</Col>
	    </Row>
            :
            <>
		{groups.length > 1 ?
		 <Card className="mb-3">
                     <Card.Header>
                         <Row>
                             <Col lg={4}>
                                 <Form.Group>
                                     <Form.Label>Choose your group</Form.Label>
				      <Form.Select value={selectedGroup.uuid} onChange={(e)=>makeSelect(e)}>
                                         {groups.map((a, index) => {
                                             return (
                                                 <option key={index} value={a.uuid}>{a.name}</option>
                                             )
                                         })
                                         }
                                      </Form.Select>
                                 </Form.Group>
                             </Col>
			 </Row>
		     </Card.Header>
		 </Card>
		 :
		 ""
		}

		{apiError &&
		 <Alert variant="danger">{apiError}</Alert>
		}
		{id &&
		 <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Groups /</span> <Link to="/cvdp/groups/">Group Search</Link> / Group Detail</h4>
		}

		{ selectedGroup ?
		<Tab.Container
		    defaultActiveKey="group"
		    activeKey = {activeTab}
		    className="mb-3"
		    onSelect={setActiveTabNow}
		>
		    <Nav variant="pills" className="mb-3">
			<Nav.Item key="group">
			    <Nav.Link eventKey="group"><i className="bx bx-user me-1"></i>{" "}{id ? "Group Details" : "My Contacts"}</Nav.Link>
			</Nav.Item>
			{groupAdmin &&
			 <>
                             <Nav.Item key="contactinfo">
				 <Nav.Link eventKey="contactinfo"><i className="fas fa-mobile-alt"></i>{" "} Contact Information {selectedGroup.support_emails?.length > 0 ? "" : <i className="fas fa-exclamation-triangle text-danger"></i> }</Nav.Link>
                             </Nav.Item>

			     <Nav.Item key="permissions">
				 <Nav.Link eventKey="permissions"><i className="fas fa-user-lock"></i>{" "} Permissions</Nav.Link>
                             </Nav.Item>

			     <Nav.Item key="verifications">
				 <Nav.Link eventKey="verifications"><i className="bx bx-bell"></i>{" "}Unverified users {unverifiedContacts.length > 0 ? <i className="fas fa-exclamation-triangle text-danger"></i> : "" }</Nav.Link>
                             </Nav.Item>

			     <Nav.Item key="api">
				 <Nav.Link eventKey="api"><i className="fas fa-key"></i>{" "} API</Nav.Link>
                             </Nav.Item>
			 </>
			}
			{id &&
			 <>
			     <Nav.Item key="cases">
				 <Nav.Link eventKey="cases"><i className="fas fa-briefcase"></i>{" "}Cases</Nav.Link>
			     </Nav.Item>
			     <Nav.Item key="components">
				 <Nav.Link eventKey="components"><i className="fas fa-microchip"></i>{" "}Components</Nav.Link>
			     </Nav.Item>
			 </>
			}


		    </Nav>
		    <Tab.Content id="admin-fns" className="p-0">
			<Tab.Pane eventKey="group" key="group">
			    {selectedGroup &&
			    <Card className="mb-4">

				<Card.Header as="h5">
				    <div className="d-flex justify-content-between gap-2 flex-column flex-sm-row">
					<div className="d-flex align-items-center gap-1 flex-column flex-sm-row">
					    {selectedGroup.photo ?
					     <Image className="large-profile rounded-circle" src={selectedGroup.photo} rounded />
					     :
					     <>
						 <div className="d-block rounded large-profile rounded-circle text-center flex-shrink-0" style={{backgroundColor: selectedGroup.logocolor}}>
						 <span className="logo-initial">{selectedGroup.name[0]}</span></div>
					     </>
					    }

					    <h3 className="px-3">
						{selectedGroup.name}
						{id &&
						 <>
						     {groups[0].active ?
						      " (Active)"
						      :
						      " (Inactive)"
						     }
						 </>
						}
					    </h3>
					    {groupAdmin &&
					    <div className="button-wrapper">
						<div className="mb-2 d-flex align-items-center  gap-2">
						    <Button
							onClick={(e)=>generateNewColor()}
							variant="outline-secondary"
							size="sm">
						    <i className="fas fa-palette"></i> New icon color</Button>
						<label htmlFor="upload" className="btn btn-primary btn-sm">
						    <span className="d-sm-block">Upload logo</span>
						    <input
							type="file"
							id="upload"
							aria-label="upload logo for group"
							className="account-file-input visually-hidden"
							accept="image/png, image/jpeg"
							onChange={(e)=>addLogo(e)}
						    />
						</label>
						    {selectedGroup.photo &&
						     <Button variant="outline-secondary" size="sm" onClick={(e)=>resetImage()}>
							 <span className="d-sm-block">Reset</span>
						     </Button>
						    }
						</div>
						<p className="text-muted small mb-0">Allowed JPG, GIF or PNG. Max size of 800K</p>
					    </div>
					    }
					</div>

					
					{groupAdmin &&
					 <DropdownButton
					     variant="primary"
					     title={
						 <span>Manage <i className="fas fa-chevron-down"></i></span>
					     }
					     onSelect={handleManage}
					 >
					     <Dropdown.Item eventKey="add">Add Contact</Dropdown.Item>
					     <Dropdown.Item eventKey="edit">Edit Contact</Dropdown.Item>
					     <Dropdown.Item eventKey="remove">Remove Contact{selectedRows.length > 1 && `s`}</Dropdown.Item>
					     {id &&
					      <>
						  {groups[0].active ?
						   <Dropdown.Item eventKey="deactivate">Deativate Group</Dropdown.Item>
						   :
						   <Dropdown.Item eventKey="activate">Activate Group</Dropdown.Item>
						  }
						  <Dropdown.Item eventKey="tag">Tag Group</Dropdown.Item>
						  {contacts.length > 0 &&
						   <Dropdown.Item eventKey="message">Message Group</Dropdown.Item>
						  }
						  <Dropdown.Item eventKey="delete">Remove Group</Dropdown.Item>
						  <Dropdown.Item eventKey="unverify">Unverify User</Dropdown.Item>
					      </>
					     }

					 </DropdownButton>
					}
				    </div>
				</Card.Header>
				{id && selectedGroup.tags?.length > 0 &&
				 <Card.Body className="pb-0">
				     <Stack direction="horizontal" gap={2}>                                                                         
                                         {selectedGroup.tags.length > 0 &&
                                          <>                                                                                                        
                                              <Form.Label className="mb-0">Tags:</Form.Label> {selectedGroup.tags.map((tag, index) => (
                                                  <Badge key={`tag-${index}`}  bg="primary">{tag}</Badge>
                                              ))}                                                                                                   
                                          </>
                                         }                                                                                                          
                                     </Stack>     
				 </Card.Body>
				}
				<Card.Body>
				    <div className="flex justify-center mt-8 overflow-scroll">
					<GroupAdminTable
					    columns={columns}
					    data = {contacts}
					    setSelectedRows = {handleSelectedRows}
					    fetchData = {fetchContacts}
					    group = {selectedGroup}
					    api = {contactapi}
					    loading= {tableLoading}
					    update={update}
					    hidden={tableState}
					/>

				    </div>
				    <div className="float-end">
					<Toast
					    bg={showToast.type}
					    onClose={() =>
						setShowToast({ show: false, type: "success" })
					    }
					    show={showToast.show}
					>
					    <Toast.Body>{showToast.msg}</Toast.Body>
					</Toast>
				    </div>
				</Card.Body>
				
				<AddContactModal
				    showModal = {addContactModal}
				    hideModal = {hideContactModal}
				    title = {editContact? "Edit Contact" : `Add Contact to ${selectedGroup.name}`}
				    edit = {editContact}
				    group = {selectedGroup}
				/>
				
				<DeleteConfirmation
				    showModal={displayConfirmationModal}
				    confirmModal={submitRemoveContact}
				    hideModal={hideConfirmationModal}
				    id={removeID}
				    message={deleteMessage} />
			    </Card>


			    }
			</Tab.Pane>
			{groupAdmin &&
			 <>

			     <Tab.Pane eventKey="contactinfo" key="contactinfo">
				 <Card>
				     <Card.Header as="h5">
					 <Card.Title>Organization Contact Information
					 </Card.Title>
				     </Card.Header>
				     <Card.Body>
					 <GroupContactApp
					     group={selectedGroup}
					     update = {fetchInitialData}
					 />
				     </Card.Body>
				 </Card>
			     </Tab.Pane>
                             <Tab.Pane eventKey="permissions" key="permissions">
				 <Card>
                                     <Card.Header as="h5">
					<Card.Title> Group Case Permissions</Card.Title>
                                     </Card.Header>
				     <Card.Body>
					 <Form.Group className="mb-3">
					     <Form.Check
						 type="radio"
						 name="perm_type"
						 value="all"
						 checked={permType==="all"}
						 label="All verified users have read/write access to all cases"
						 onChange={(e)=>(setPermType("all"), updatePermScheme("all"))}
					     />
					     <Form.Check
						 type="radio"
						 name="perm_type"
						 value="select"
						 checked={permType==="select"}
						 label="Select individual access permissions per user"
						 onChange={(e)=>(setPermType("select"), updatePermScheme("select"))}
					     />
					 </Form.Group>
					 {permType === "select" &&
					  <div className="flex justify-center mt-8">
					      {contacts.length > 0 ?
					       <CasePermissionApp
						   group={selectedGroup}
						   contacts={contacts}
					       />
					       :
					       <div className="alert alert-warning">
						   Add users to change change permissions.
					       </div>
					      }
					 </div>
					 }

				     </Card.Body>
				     
				 </Card>

				 
                             </Tab.Pane>

			     <Tab.Pane eventKey="verifications" key="verifications">
				 <Card>
                                     <Card.Header as="h5">
					 <Card.Title>Unverified Users</Card.Title>
                                     </Card.Header>
				     <Card.Body>
					 <div className="flex justify-center mt-8">
                                             <GroupAdminTable
						 columns={unverified_columns}
						 data = {unverifiedContacts}
						 setSelectedRows = {noSelect}
						 fetchData = {fetchUnverifiedContacts}
						 group = {selectedGroup}
						 api = {contactapi}
						 loading= {unverifiedTableLoading}
						 update={unverifiedUpdate}
						 hidden={tableState}
                                             />
					 </div>
                                     </Card.Body>
				 </Card>

                             </Tab.Pane>

			     <Tab.Pane eventKey="api" key="api">
				 <Card>
                                     <Card.Header as="h5">
					 <div className="d-flex justify-content-between align-items-start">
					     <Card.Title>Group API Keys</Card.Title>
					     <Button
						 variant="primary"
						 disabled={selectedGroup.support_emails?.length > 0 ? false : true}
						 onClick={()=>createAPIKey()}
					     >Add API Key</Button>
					 </div>
                                     </Card.Header>
				     <Card.Body>
					 <>
					     {apiKey &&
					      <Alert variant="success">Your API Key is: <b><OverlayTrigger
											       placement="right"
											       delay={{ show: 250, hide: 400 }}
											       overlay={renderCopyTooltip}
											   >
											       <span className="api_token" onClick={() => navigator.clipboard.writeText(apiKey)}>
											       {apiKey}</span>
											   </OverlayTrigger>
											</b>
						  <br/>
						  Copy this key to safe place. Should you lose access to this key, you will have to generate a new one.
					      </Alert>
					     }
					 </>

					 {selectedGroup.support_emails?.length > 0 ?

					  <>
					      {keys.length > 0 ?
					       <Table striped bordered hover>
						   <thead>
						       <tr>
							   <th>Key</th>
							   <th>Created</th>
							   <th>Last Used</th>
							   <th>Action</th>
						       </tr>
						   </thead>
						   <tbody>
						       {keys.map((k, index) => {

							   let created = new Date(k.created);
							   let last_used = k.last_used ? formatDistance(new Date(k.last_used), new Date(), {addSuffix: true}) : "Not used";

							   return (
							       <tr key={k.last_four}>
								   <td>
								       ******{k.last_four}
								   </td>
								   <td>
								       {format(created, 'yyyy-MM-dd H:mm:ss')}
								   </td>
								   <td>
								       {last_used}
								   </td>
								   <td>
								       <Button variant="btn-icon p-1" onClick={()=>confirmRemoveAPI(k)}><i className="fas fa-trash" title="REmove API Key"></i></Button>
								       <Button variant="btn-icon p-1" onClick={()=>confirmRefresh(k)}><i className="fas fa-sync-alt" title="Refresh API Key"></i></Button>
								   </td>
							       </tr>
							   )
						       })}
						   </tbody>
					       </Table>
					       :
					       <p>No API accounts have been created.</p>

					      }
					  </>
					  :
					  <Alert variant="danger">Please add an email address for your organization before adding an API key.</Alert>
					 }
				     </Card.Body>
				 </Card>

                             </Tab.Pane>
			 </>
			}

			{id &&
			 <>
			     <Tab.Pane eventKey="cases" key="cases">
				 <Card>
				     <Card.Header as="h5">
					 <Card.Title>Cases</Card.Title>
				     </Card.Header>
				     <Card.Body>
					 {casesLoading ?
					  <div className="text-center">
					      <div className="lds-spinner"><div></div><div></div><div></div></div>
					  </div>
					  :
					 <CaseList
					     cases={cases}
					     count={itemsCount}
					     page = {currentPage}
					     setCurrentPage={setCurrentPage}
					     emptymessage="This group is not participating in any cases."
					 />
					 }
				     </Card.Body>
				 </Card>
			     </Tab.Pane>

			     <Tab.Pane eventKey="components" key="components">
				 <ComponentTable
				     group={id}
				 />
			     </Tab.Pane>
			 </>
			}

		    </Tab.Content>
		</Tab.Container>
		  :
		  <div className="alert alert-danger">No group selected.</div>
		}


		{id &&
		<TagModal
                    showModal = {displayTagModal}
                    hideModal = {hideTagModal}
                    dataType = "group"
                    options = {[]}
                    tags = {selectedGroup.tags}
                    submitTags = {saveTags}
                />
		}
		<Card className="mt-4">
		    <Card.Header as="h5">
			<Card.Title>Recent Activity</Card.Title>
		</Card.Header>
		<Card.Body>
		    {activityLoading ?
                     <div className="text-center">
                         <div className="lds-spinner"><div></div><div></div><div></div></div>
                     </div>
                     :
		     <ListGroup variant="flush">
                         {activity.map((a, index) => {
                             return (
                                 <ListGroup.Item action className="p-2 border-bottom" key={`activity-${index}`}>
                                     <ActivityApp
                                         activity = {a}
				     />
                                 </ListGroup.Item>
                             )
                         })}
			 {activityHasMore &&
			  <Button variant="primary" onClick={(e)=>fetchMoreActivity()}>Load More</Button>
			 }
                     </ListGroup>
		    }
		</Card.Body>
	    </Card>

	    </>
    )

}


export default GroupAdminApp;
