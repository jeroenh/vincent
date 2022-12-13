import React, { useState, useCallback, useEffect, useRef } from "react";
import ComponentAPI from "./ComponentAPI";
import DeleteConfirmation from "./DeleteConfirmation";
import EditStatusModal from "./EditStatusModal";
import StatusModal from "./StatusModal";
import {
    Badge,
    Card,
    Table,
    Alert,
    OverlayTrigger,
    Tooltip,
    DropdownButton,
    Dropdown,
    Accordion,
    Row,
    Col,
    Button,
} from "react-bootstrap";
import DisplayVulStatus from "./DisplayVulStatus";
import StatusTransferModal from "./StatusTransferModal";
import ErrorModal from "./ErrorModal";
import { Link, useSearchParams } from "react-router";
import StatusForm from "./StatusForm";
import "../css/casethread.css";

const componentapi = new ComponentAPI();

const DisplayVulStatusSummary = (props) => {
    const { status } = props;

    return (
        <>
            {status.map((b, index) => {
                return (
                    <DisplayVulStatus
                        key={`${b.status}-${index}`}
                        status={b.status}
                        count={b.count}
                    />
                );
            })}
        </>
    );
};

const StatusAddForm = (props) => {

    const caseInfo = props.caseInfo;
    let [searchParams, setSearchParams] = useSearchParams();
    const [accordionIndex, setAccordionIndex] = useState(null);
    const [error, setError] = useState(null);
    const [displayErrorModal, setDisplayErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [confirmButtonText, setConfirmButtonText] = useState("Delete");
    const [drfError, setDRFError] = useState(null);
    const [transfers, setTransfers] = useState([]);
    const [reqUser, setReqUser] = useState(props.user);
    const [questions, setQuestions] = useState([]);
    const [formTitle, setFormTitle] = useState("Add Component Status");
    const [isLoading, setIsLoading] = useState(true);
    const [vuls, setVuls] = useState([]);
    const [caseComponents, setCaseComponents] = useState([]);
    const [showMoreComponents, setShowMoreComponents] = useState(0);
    const [showForm, setShowForm] = useState(false);
    const [comp, setComp] = useState(null);
    const [endVersion, setEndVersion] = useState("");
    const [checkedVuls, setCheckedVuls] = useState([]);
    const [editStatus, setEditStatus] = useState(null);
    const [displayConfirmationModal, setDisplayConfirmationModal] =
        useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [removeID, setRemoveID] = useState(null);
    const [allowAddStatus, setAllowAddStatus] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);

    const formRef = useRef(null);
    const navRef = useRef(null);

    const hideErrorModal = () => {
        setDisplayErrorModal(false);
    };

    const radios = [
        { name: "Share", value: true },
        { name: "Don't Share", value: false },
    ];

    const hideStatusModal = () => {
        setShowStatusModal(false);
    };

    const hideTransferModal = (transfers) => {
        setShowTransferModal(false);
        getSelectedComponents();
        if (transfers == 0) {
            setTransfers([]);
        }
    };

    function removeStatus(id) {
        setRemoveID(id);
	setConfirmButtonText("Delete");
        setDeleteMessage("Are you sure you want to remove this status?");
        setDisplayConfirmationModal(true);
    }

    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    };

    const submitRemoveStatus = (id) => {

	if (id === parseInt(id, 10)) {
            componentapi
		.removeStatus(id)
		.then((response) => {
                    getSelectedComponents();
		})
		.catch((err) => {
                    setErrorMessage(
			`Error removing component status: ${err.message}. Is this case assigned?`
                    );
                    setDisplayErrorModal(true);
                    console.log(err);
		});
	} else {
	    /* data is not an integer */
	    id['confirm'] = 1;
	    submitStatus(id);
	}


        setDisplayConfirmationModal(false);
    };

    function editStatusNow(c, q) {
        /*checked vuls is the id of the actual status */
        setCheckedVuls([q.id]);
        setEditStatus({status: q, component: c});
        setShowForm(true);
        setFormTitle(`Edit status for ${c.component.name}`);
    }

    function cloneStatus(c, q) {
	/*checked vuls is the id of the actual status */
	setCheckedVuls([q.id]);
	setEditStatus({status: q, component: c, clone: true});
	setShowForm(true);
	setFormTitle(`Clone status for ${c.component.name}`);
    }

    function viewStatusDetails(comp, vul) {
        setShowForm(false);
        setEditStatus(vul);
        setComp(comp);
        setShowStatusModal(true);
    }

    const closeStatusForm = () => {
	setShowForm(false);
	//setEditStatus(null);
	if (searchParams.get('component')) {
	    searchParams.delete('component');
	}
	if (searchParams.get('vul')) {
	    searchParams.delete('vul');
	}
	setSearchParams(searchParams);

	getSelectedComponents();
        if (props.updateVuls) {
            props.updateVuls();
	}
    }


    const submitStatus = (data) => {
        try {
            if (editStatus && !editStatus.clone) {
                componentapi
                    .editStatus(checkedVuls[0], data)
                    .then((response) => {
                        addStatus();
                        getSelectedComponents();
                        if (props.updateVuls) {
                            props.updateVuls();
                        }
                        setShowForm(false);
                    })
                    .catch((err) => {
                        console.log(err);
                        if (err.response?.status == 400) {
                            setDRFError(err.response.data);
                        } else {
                            setErrorMessage(
                                `Error editing status: ${err.message}`
                            );
                        }
                        setDisplayErrorModal(true);
                    });
            } else {
                componentapi
                    .addStatus(caseInfo, data)
                    .then((response) => {
                        addStatus();
                        getSelectedComponents();
                        if (props.updateVuls) {
                            props.updateVuls();
                        }
                        setShowForm(false);
                    })
                    .catch((err) => {
                        console.log(err);
                        if (err.response?.status == 400) {
			    if ('confirm' in err.response?.data) {
				setDRFError(null);
				setDeleteMessage("A status for this component already exists, do you want to overwrite it?")
				setRemoveID(data)
				setConfirmButtonText("Overwrite")
				setDisplayConfirmationModal(true);
			    } else {
				setDRFError(err.response.data);
				setDisplayErrorModal(true);

			    }
                        } else {
                            setErrorMessage(
                                `Error adding status: ${err.message}`
                            );
			    setDisplayErrorModal(true);

                        }
                    });
            }
        } catch (err) {
            console.log(err);
        }
    };

    /*
    useEffect(() => {
        //setIsLoading(false);
        navRef.current?.scrollIntoView();
    }, [vuls]);
    */



    useEffect(() => {
        //setIsLoading(true);
        setVuls(props.vuls);
    }, [props.vuls]);



    useEffect(() => {
        if (props.active) {
            getSelectedComponents();
        }
    }, [props.active]);

    useEffect(() => {

        if (["owner", "coordinator"].includes(props.user.role)) {
            setTransfers(props.transfers);
        }

        if (["owner", "supplier"].includes(props.user.role)) {
            setAllowAddStatus(true);
        }
    }, [props.user, props.transfers]);

    const getSelectedComponents = async () => {
        setIsLoading(true);
        await componentapi
            .getComponentStatus(caseInfo)
            .then((response) => {
		if (editStatus) {
		    if (editStatus.component) {
			console.log(response.results);
			console.log(editStatus);
			let x = response.results.find((x, index) => x.component.id == editStatus.component.component.id);
			console.log(x);
			if (x) {
			    setAccordionIndex(`c-${response.results.indexOf(x)}`)
			    console.log(response.results.indexOf(x));
			} else {
			    setAccordionIndex(null);
			}
		    }
		    setEditStatus(null);
		}

		if (searchParams.get('vul') && searchParams.get('component')) {
		    console.log(`here!!! ${searchParams.get('vul')}, ${searchParams.get('component')}`);
		    let v = null;
		    let comp = null;
		    response.results.forEach((x, index) => {
			if (x.component.id == searchParams.get('component')) {
			    /* find vul */
			    let vt = x.vuls.find(y => y.vul.id == searchParams.get('vul'));
			    if (vt) {
				comp = x;
				v = vt;
			    }
			}
		    });
		    if (v && comp) {
			console.log(v);
			console.log(comp);
			editStatusNow(comp, v, props.user);
		    }
		}

                setCaseComponents(response.results);
                if (response.next) {
                    setShowMoreComponents(response.count);
                }
                setIsLoading(false);
            })
            .catch((err) => {
                console.log("Error:", err);
                setError(`Error retrieving component status: ${err.message}`);
                setIsLoading(false);
            });
    };

    function addStatus() {
        setEditStatus(null);
        setFormTitle("Add Component Status");
        setCheckedVuls([]);
    }


    const ApprovalBanner = (props) => {

	let pending = 0;
	if (!["owner", "supplier"].includes(props.user.role)) {
	    return "";
	}

	props.components.forEach(y => {
	    y.vuls.forEach(v => {
		if (!v.approved) {
		    if (props.user.role == "owner") {
			pending = pending + 1;
		    } else if (v.user?.uuid == props.user.user.uuid) {
			pending = pending + 1;
		    }
		}
	    });
	});

	if (pending > 0) {
	    if (props.user.role == "owner") {
		return (
		    <Alert variant="danger">You have {pending} status{pending > 1 && `es`} to approve. <Link to={"dash"} state={{caseInfo: caseInfo, reqUser: props.user}}>View Pending</Link></Alert>
		)
	    } else {
		return (
		    <Alert variant="danger">Your status is pending coordinator approval.</Alert>
		)
	    }
	} else {
	    return "";
	}
    }

    /* this returns if the non-coordinator user can edit any specific vendor status */
    const get_status_editable = (c) => {
	if (reqUser.role == "owner") {
	    return false;
	}
        const groups = reqUser.groups?.length > 0 ? reqUser.groups.map((x) => x.name) : [];
	if (groups.includes(c.component.owner?.name)) {
	    return true;
	}
	return c.vuls.some(x => x.user?.uuid === reqUser.user.uuid);
    }
    
    const ActionColumn = (props) => {
        const { component, vulstatus, user } = props;
        const groups = user.groups?.length > 0 ? user.groups.map((x) => x.name) : [];
	/* determine if this user can edit this status by looking at:
	   #1 case role
	   #2 component owner - is this user a member of the group that "owns" the component
	   #3 the user that provided this status
	*/
	let editable = user.role === "owner" || groups.includes(component.component.owner?.name) || vulstatus.user.uuid === user.user?.uuid;

        return (
            <div className="text-nowrap">
                {editable &&
		 <>
                     <Button
			 variant="btn-icon px-1 edit-status-btn"
			 title="Edit Status"
			 onClick={(e) => editStatusNow(component, vulstatus)}
                     >
			 <i className="fas fa-edit" title="Edit Status"></i>
                     </Button>
		     <Button
			 variant="btn-icon px-1 clone-status-btn"
			 title="Duplicate Status"
			 onClick={(e) => cloneStatus(component, vulstatus)}
                     >
			 <i className="fas fa-copy" title="Duplicate Status"></i>
                     </Button>
		 </>
		}
                <Button
                    variant="btn-icon px-1 view-status-btn"
		    title="View Status Details"
                    onClick={(e) => viewStatusDetails(component, vulstatus)}
                >
                    <i className="fas fa-search-plus" title="View Status Details"></i>
                </Button>
                {editable &&
                 <Button
		     title="Remove Status"
                     variant="btn-icon px-1 rm-status-btn"
                     onClick={(e) => removeStatus(vulstatus.id)}
                 >
                     <i className="fas fa-trash" title="Remove Status"></i>
                 </Button>
		}
            </div>
        );
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
        <>
            {vuls && reqUser ? (
                <>
                    <div
                        className="d-flex align-items-center justify-content-between"
                        ref={navRef}
                    >
                        <h5>Component Status</h5>
                        {allowAddStatus && (
                            <>
                                {vuls.length > 0 && (
                                    <>
                                        {caseComponents &&
                                        caseComponents.length > 0 ? (
                                            <DropdownButton
                                                variant="btn p-0"
                                                id="status-dropdown"
                                                title={
                                                    <i className="bx bx-dots-vertical-rounded" title="Manage Status"></i>
                                                }
                                            >
                                                <Dropdown.Item
                                                    eventKey="add"
                                                    onClick={() => (
                                                        addStatus(),
							setShowForm(true)
                                                    )}
                                                >
                                                    Add Status
                                                </Dropdown.Item>
                                                <Dropdown.Item
                                                    as={Link}
                                                    to="status"
						    data-testid="status-view-all"
                                                >
                                                    View All
                                                </Dropdown.Item>
                                            </DropdownButton>
                                        ) : (
                                            <Button
                                                type="button"
                                                id="status-dropdown"
                                                className="btn btn-primary"
                                                onClick={() =>
                                                    setShowForm(true)
                                                }
                                            >
                                                Add Status
                                            </Button>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                    {transfers && transfers.length > 0 && (
                        <>
                            <Alert variant="warning" className="mt-2">
                                This case has status transfers waiting to be
                                approved.{" "}
                                <a
                                    href="#"
                                    onClick={(e) => setShowTransferModal(true)}
                                >
                                    View transfer requests
                                </a>
                            </Alert>

                            <StatusTransferModal
                                showModal={showTransferModal}
                                hideModal={hideTransferModal}
                                transfers={transfers}
                            />
                        </>
                    )}

                    {vuls.length == 0 && (
                        <>
                            {reqUser.role === "owner" ? (
                                <p>
                                    Add a vulnerability before adding affected
                                    component status.
                                </p>
                            ) : (
				<p>
				    We are working on identifying the vulnerabilties in this case. Status can be added once vulnerabilities are defined.
				</p>
                            )}
                        </>
                    )}

                    {caseComponents.length == 0 && (
			<>
			    {allowAddStatus && reqUser.role === "supplier" ?
			     <><h6 className="warningtext"><i className="fas fa-exclamation-triangle"></i> Action Required</h6>

				 <p>Please let us know if your organization is vulnerable to any of the vulnerabilities identified in this case.</p>
			     </>
			     :
			     <>
				 {vuls.length > 0 &&
				  <p>We are working on identifying components that may be affected by the vulnerabilities identified in this case. Check back soon.</p>
				 }
			     </>
			    }
			</>
                    )}

                    {showMoreComponents > 0 && (
                        <p>
                            Showing {caseComponents.length} of{" "}
                            {showMoreComponents} results.{" "}
			    <Link to={"status"}>View all</Link>
                        </p>
                    )}


                    {caseComponents && (
			<>
			    <ApprovalBanner
				components = {caseComponents}
				user={reqUser}
			    />

                        <Accordion defaultActiveKey={accordionIndex}>
			    {caseComponents.map((c, index) => {
				let editable = get_status_editable(c);
                                return (
                                    <Accordion.Item
                                        className="card mt-2"
                                        eventKey={`c-${index}`}
                                        key={index}
                                    >
                                        <Accordion.Header>
                                            <div className="d-flex gap-2 justify-content-between align-items-center">
                                                <span>
                                                    {c.component.owner ? (
                                                        `${c.component.owner.name}/`
                                                    ) : (
                                                        <>
                                                            <OverlayTrigger
                                                                overlay={
                                                                    <Tooltip>
                                                                        No
                                                                        supplier
                                                                        provided
                                                                        for
                                                                        component.
                                                                        CSAF
                                                                        Advisory
                                                                        will not
                                                                        include
                                                                        status
                                                                        without
                                                                        supplier.
                                                                    </Tooltip>
                                                                }
                                                            >
                                                                <i className="fas fa-exclamation-triangle warningtext"></i>
                                                            </OverlayTrigger>{" "}
                                                        </>
                                                    )}
                                                    {c.component.name}
						    {c.other_component &&
						     <span>{" "}{c.relationship.replace(/_/g, " ")} {c.other_component.name} {c.other_component_version}</span>
						    }
                                                </span>
						{reqUser.role === "owner" && c.vuls.some(x => !x.approved) &&
						 <OverlayTrigger
                                                     overlay={
                                                         <Tooltip>
							     A status requires
							     coordinator approval.
                                                         </Tooltip>
                                                     }
                                                 >
						     <i className="fas fa-exclamation warningtext" title="Requires Approval"></i>
						 </OverlayTrigger>
						}
                                                <DisplayVulStatusSummary
                                                    status={c.summary}
                                                />
                                            </div>
                                        </Accordion.Header>
                                        <Accordion.Body>
					    {editable && c.vuls.every(y => y.approved) &&
					     <Alert variant="success">
						 Status has been approved by a coordinator.
					     </Alert>
					    }

					    <div className="d-flex align-items-start gap-3 mb-2">
                                                <div>
                                                    <b>Component: </b>
                                                    {reqUser.role ===
                                                    "owner" ? (
                                                        <a
                                                            href={`/cvdp/components/${c.component.id}/`}
                                                        >
                                                            {c.component.name}
                                                        </a>
                                                    ) : (
                                                        <span>
                                                            {c.component.name}
                                                        </span>
                                                    )}
                                                </div>
                                                {c.component.owner ? (
                                                    <div>
                                                        <b>Owner: </b>
                                                        {reqUser.role ===
                                                        "owner" ? (
                                                            <a
                                                                href={`/cvdp/groups/${c.component.owner.uuid}`}
                                                            >
                                                                {
                                                                    c.component
                                                                        .owner
                                                                        .name
                                                                }
                                                            </a>
                                                        ) : (
                                                            <span>
                                                                {
                                                                    c.component
                                                                        .owner
                                                                        .name
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <i className="fas fa-exclamation-triangle warningtext"></i>{" "}
                                                        <b>
                                                            No supplier provided
                                                            for component. CSAF
                                                            Advisory will not
                                                            include status
                                                            without supplier.
                                                        </b>
                                                    </div>
                                                )}
                                            </div>

                                            {c.vuls.map((v, idx) => (
						<Row className="g-4 border-bottom py-2" key={`vul-${idx}`}>
                                                    <Col lg={12} key={idx}>
							<div className="d-flex justify-content-between">
							    <p className="lead">{ v.vul.vul }{v.vul.title && `: ${v.vul.title}`}
							    {v.approved && editable &&
							     <Badge bg="success" className="ms-2" pill title="A coordinator has approved your status">Approved</Badge>
							    }
							    </p>
                                                            <ActionColumn
                                                                component={
                                                                    c
                                                                }
                                                                vulstatus={
                                                                    v
                                                                }
                                                                user={
                                                                    reqUser
                                                                }
                                                            />
                                                        </div>
							<Table className="mb-3">
							    <tbody>
                                                            {v.status.map(
                                                                    (
                                                                        status,
                                                                        index
                                                                    ) => (
                                                                        <tr
                                                                            key={`${v.id}-${index}`}
                                                                        >
									    <td>
                                                                                <a
                                                                                    href={`/cvdp/components/${c.component.id}/`}
                                                                                >
                                                                                    {
                                                                                        status.version_value
                                                                                    }{" "}
                                                                                    {status.version_range
                                                                                        ? status.version_range
                                                                                        : ""}{" "}
                                                                                    {status.version_end_range
                                                                                        ? status.version_end_range
                                                                                        : ""}{" "}
                                                                                </a>
									    </td>
									    <td>
                                                                                <DisplayVulStatus
                                                                                    status={
                                                                                        status.status
                                                                                    }
                                                                                />
                                                                            </td>
									    <td className="text-break">
										{status.remediation_category &&
										 <span>{status.remediation_category}: {status.remediation_detail}</span>
										}
									    </td>
                                                                        </tr>
                                                                    )
                                                            )}
							    </tbody>
							</Table>
                                                        {v.statement && (
                                                            <div>
                                                                <b>
                                                                    Statement:
                                                                </b>{" "}
                                                                {
                                                                    v.statement
                                                                }
                                                            </div>
                                                        )}
                                                    </Col>
						</Row>
                                                ))}

                                        </Accordion.Body>
                                    </Accordion.Item>
                                );
                            })}
                        </Accordion>
			    </>
                    )}
                    <div id="testref" ref={formRef}>
                        &nbsp;{" "}
                    </div>
                    <DeleteConfirmation
                        showModal={displayConfirmationModal}
                        confirmModal={submitRemoveStatus}
                        hideModal={hideConfirmationModal}
                        id={removeID}
                        message={deleteMessage}
			buttonText={confirmButtonText}
                    />
		    <EditStatusModal
		        showModal = {showForm}
			hideModal = {closeStatusForm}
			component = {editStatus?.component}
			vuls={vuls}
			compstatus = {editStatus?.status}
			user = {reqUser}
			submit={submitStatus}
			clone= {editStatus?.clone || false}
                    />
                    <StatusModal
                        showModal={showStatusModal}
                        hideModal={hideStatusModal}
                        component={comp}
                        status={editStatus}
                        vuls={vuls}
                        user={reqUser}
                    />
                    <ErrorModal
                        showModal={displayErrorModal}
                        hideModal={hideErrorModal}
                        message={errorMessage}
                        drf={drfError}
                    />
                </>
            ) : (
                <p className="lead">
                    Once vulnerabilites have been added, we will request that
                    you update your status.
                </p>
            )}
        </>
    );
};

export default StatusAddForm;
