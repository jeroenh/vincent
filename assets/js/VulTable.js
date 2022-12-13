import React, { useState, useEffect, useRef, useMemo } from 'react';
import CaseThreadAPI from './ThreadAPI';
import {Table, Card, Badge, DropdownButton, Dropdown, Alert, Accordion, Row, Col, Button, Form} from 'react-bootstrap';
import { format, formatDistance } from 'date-fns';
import axios from 'axios';
import Searchbar from './Searchbar';
import BasicTable from './BasicTable';
import CVSSSeverityBadge from "./CVSSSeverityBadge";
import {useParams, useNavigate, Link, useLocation} from "react-router";
import ScoreModal from './ScoreModal';
import ErrorModal from './ErrorModal';
import DeleteConfirmation from "./DeleteConfirmation";
import EditVulModal from "./EditVulModal";

const threadapi = new CaseThreadAPI();

// Create an editable cell renderer
const EditableCell = ({
    value: initialValue,
    row: { index },
    column: { id },
    updateMyData, // This is a custom function that we supplied to our table instance
}) => {
    // We need to keep and update the state of the cell normally
    const [value, setValue] = React.useState(initialValue)
    
    const onChange = e => {
	setValue(e.target.value)
    }
     
    // We'll only update the external data when the input is blurred
    const onBlur = () => {
	updateMyData(index, id, value)
    }
    
    // If the initialValue is changed external, sync it up with our state
    React.useEffect(() => {
	setValue(initialValue)
    }, [initialValue])
    
    return <textarea rows="5" className="vultable-textarea" value={value} onChange={onChange} onBlur={onBlur} />
}


const VulTable = (props) => {

    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [caseInfo, setCaseInfo] = useState(location.state?.caseInfo);
    const [reqUser, setReqUser] = useState(location.state?.reqUser);
    const [filteredData, setFilteredData] = useState([]);
    const [data, setData] = useState(location.state?.vuls);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState({msg: '', variation: ''});
    const [drfError, setDRFError] = useState(null);
    const [displayErrorModal, setDisplayErrorModal] = useState(false);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [removeID, setRemoveID] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);
    const [searchVal, setSearchVal] = useState(null);
    const [viewScoreModal, setViewScoreModal] = useState(false);
    const [editVul, setEditVul] = useState(null);
    const [showEditVulModal, setShowEditVulModal] = useState(false);
    const [scoreVul, setScoreVul] = useState(null);
    const [modalTitle, setModalTitle] = useState("Edit Vulnerability");
    const [bulk, setBulk] = useState(false);
    
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

    const hideErrorModal = () => {
        setDisplayErrorModal(false);
    };

    const color_coded = (decision) => {
        let color = "danger";
	
        switch (decision) {
        case "Act":
            color = "danger";
            break;
        case "Attend":
            color = "warning";
            break;
        case "Track*":
        case "Don't Enrich":
            color = "info";
            break;
        case "Track":
            color = "success";
            break;
        default:
            color = "danger";
        }
        return <Badge bg={color}>{decision}</Badge>;
    };

    const filterData = (value) => {
        if (value === "") {
            setFilteredData(data)
        } else {
            const result = data.filter((item) => {
                return (
                    item.vul.toString()
                        .toLowerCase()
                        .indexOf(value.toLowerCase()) > -1
			||
			item.description.toString()
			.toLowerCase()
			.indexOf(value.toLowerCase()) > -1
			||
			item.title?.toString()
			.toLowerCase()
			.indexOf(value.toLowerCase()) > -1
			||
			item.date_public?.toString()
			.indexOf(value.toLowerCase()) > -1
                );
            });
            setFilteredData(result)
	}
    }
    
    // Searchbar functionality
    const onSearchbarChange = e => {
        const value = e.target.value
        setSearchVal(value);
	if (!value) {
	    setFilteredData(data);
	} else {
            filterData(value);
	}
    }

    function doneEdit() {
        updateVuls();
    }

    function editVulNow(q) {

	if (Array.isArray(q)) {

	    if (q.length == 0) {
		setBulk(false);
		setEditVul(data)
		return;
            }

	    
	    if (q.length > 1) {
		setEditVul(q);
		setBulk(true);
		
	    } else {
		setBulk(false);
		setEditVul(q[0].original);
	    }
	} else {
	    setEditVul(q);
	}
	    
    }

    const submitRemoveVul = async () => {
	let axiosArray = [];
	selectedRows.forEach(vul => {
	    axiosArray.push(threadapi.deleteVulnerability(vul.original.id));
	});

	try {
	    await axios.all(axiosArray);
	    updateVuls();
	} catch(err) {
            setError({msg:`Error removing vulnerability: ${err.message}. Is this case assigned?`, variation: 'danger'});
            setDisplayErrorModal(true);
            console.log(err);
        }
	setDisplayConfirmationModal(false);
    }

    const hideScoreModal = () => {
        setViewScoreModal(false);
        updateVuls();
    }

    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    }

    const hideVulModal = () => {
        setShowEditVulModal(false);
    }
    
    const cols = useMemo(
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
                Header: 'CVE',
		minWidth: 175,
		Cell: EditableCell,
		accessor: 'vul',
            },
            {
                Header: 'Description',
		Cell: EditableCell,
		minWidth: 500,
		id: "description",
		accessor: row => {

		    if (row.description) {
			return row.description;
		    } else {
			return "";
		    }
		}

            },
	    {
		Header: 'Title',
		Cell: EditableCell,
		minWidth: 300,
		id: "title",
		accessor: row => {
		    if (row.title) {
			return row.title;
		    } else {
			return "";
		    }
		}
	    },
            {
                Header: 'Problem Types',
                accessor: row => {
		    if (row.problem_types?.length > 0) {
			let p = row.problem_types.map((pt, index) => {
			    return (<span key={`pt-${row.id}-${index}`}>{ pt }</span>);
			});
			return p;
		    }
		}
            },
	    {
		Header: 'Date Public',
		Cell: EditableCell,
		accessor: 'date_public',
	    },
	    {
		Header: 'Credits',
		accessor: row => {
		    if (row.acknowledgments?.length > 0) {
			let p = row.acknowledgments.map((ack, index) => {
			    console.log(ack);
			    return (<span key={`ack-${row.id}-${index}`}>{ ack.names }</span>);
			});
			return p;
		    }
		}
	    },
	    {
		Header: 'CVSS',
		accessor: row => {
		    if (row.cvss.length > 0) {
			let cvss = row.cvss.map((c, index) => {
			    return (<div key={`cvss-${row.id}-${index}`}>CVSS v{c.version}: <CVSSSeverityBadge
								severity={c.severity}/> {c.score}</div>)
			});
			return cvss;
		    } else {
			return ""
		    }
		}
	    },
	    {
		Header: 'SSVC',
		accessor: (d) => {
                    return d.ssvc_decision
                        ? color_coded(d.ssvc_decision)
                        : "";
                },
                id: "ssvcscore__final_decision",
	    },
	    {
		Header: 'Affected Products',
		accessor: (d) => {
		    return d.affected_products.length
		}
	    }
        ],
        []
    );


    const updateVuls = async () => {

	await threadapi.getVuls({'case_id': id}).then((response) => {
            setData(response);
	    setFilteredData(response);
            console.log(response);
	    setIsLoading(false);
        }).catch(err => {
            console.log(err);
            if (err.response.status == 403) {
                navigate("../err");
            } else {
                setError({msg: `Could not retrieve vulnerabilites: ${err.message} ${err.response.data.detail}`, variation: 'danger'});
            }
	    
        });
    }
	
    

    // Async Fetch
    const fetchInitialData = async () => {

	setDRFError(null);
	setError({msg: '', variation: ''});

	if (caseInfo == null) {
            await threadapi.getCase({'case': id}).then((response) => {
                setCaseInfo(response);
            }).catch(err => {
                if (err.response.status == 403 || err.response.status==404) {
                    navigate("../err");
                }
                console.log(err);
            })
        }
        if (reqUser == null) {
            await threadapi.getUserCaseState({'case': id}).then((response) => {
                setReqUser(response);
            })
        }

	if (data == null) {
	    updateVuls();
	} else {
	    setFilteredData(data);
	    setIsLoading(false);
	}

	
    }

    useEffect(()  => {
	fetchInitialData();
    }, []);


    const showDeleteModal = () => {
        /*get selected rows and add them to removeid */
	let rmids = [];
        let rmnames = [];
        selectedRows.map(item => {
            rmids.push(item.original.id)
            rmnames.push(item.original.vul)
        });
        if (rmnames.length > 0) {
            setRemoveID(rmids);
            setDeleteMessage(`Are you sure you want to remove the following vulnerabilities: ${rmnames.map(item => item).join(', ')}`);
        } else {
            setDeleteMessage("Please select a vulnerability to remove.");
        }
        setDisplayConfirmationModal(true);
    };

    const cloneVuls = async () => {

	let axiosArray = [];
	
	if (selectedRows.length == 0) {
	    setDeleteMessage("Please select a vulnerability to clone.");
	    setDisplayConfirmationModal(true);
	    return;
	}

	selectedRows.forEach((row) => {
	    let clonedVul = JSON.parse(JSON.stringify(row.original))
	    clonedVul['cve'] = clonedVul['cve'] ? `${clonedVul['cve']}_copy` : `${clonedVul['vul']}_copy`;
	    axiosArray.push(threadapi.addVul({case_id: id}, clonedVul));

	});

	try {
	    await axios.all(axiosArray);
	    setError({msg: `${selectedRows.length} vulnerabilites successfully cloned.`, variation: 'success'});
	} catch(err) {
	    console.log(err);
	    if (err.response?.data) {
                setDRFError(err.response.data);
		setDisplayErrorModal(true);
            } else {
                setError({msg:`Error submitting vulnerability information: ${err.reponse.data.detail}`, variation: 'danger'});
            }

	}

	updateVuls();
	
    }
    
    
    function handleManage(evt, evtKey) {
        switch(evt) {
        case 'add':
	    let vul = {vul: '', cve: '', case_id: id}
	    setModalTitle("Add Vulnerability");
	    editVulNow(vul);
	    setShowEditVulModal(true);
            return;
        case 'remove':
            showDeleteModal();
            return;
        case 'edit':
	    editVulNow(selectedRows);
	    setShowEditVulModal(true);
            return;
	case 'score':
	    if (selectedRows.length == 0) {
		setDeleteMessage("Please select a vulnerability to score.");
		setDisplayConfirmationModal(true);
		return;
            }
	    setScoreVul(selectedRows);
	    setViewScoreModal(true);
	    return;
	case 'clone':
	    cloneVuls(selectedRows);
	    return;
        default:
            return;
        }
    };


    const postEditVul = async (vul, callbackFn) => {

	
	const formData = {title: vul.title, description: vul.description, date_public: vul.date_public?.trim()};

	if (vul.vul.startsWith('CVE')) {
	    formData['cve'] = vul.vul;
	}
	await threadapi.updateVul(vul, formData).then((response) => {
	    console.log(response);
	    callbackFn(null);
	}).catch(err => {
	    console.log(err);
	    if (err.response?.data) {
		callbackFn(err.response.data);
            } else {
		callbackFn({error:`Error submitting vulnerability information: ${err.message}`});
            }
	});

    }


    const callback = (resp) => {
	if (resp) {
	    setDRFError(resp);
	    setDisplayErrorModal(true);
	} 
    }
    
    
    const updateRow = (rowIndex, columnId, value) => {

	let axiosarray = [];
	setData(old =>
	    old.map((row, index) => {
		if (index === rowIndex) {
		    
		    let r = {
			...old[rowIndex],
			[columnId]: value,
		    }
		    postEditVul(r, callback);
		    return r;
		}
		return row
		
	    })
	)
    }
    
    
    return (

	caseInfo ?
            <>
                <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Cases /</span> <Link to={'../?activeTab=addvuls'}>{caseInfo.case_identifier} {caseInfo.title}</Link> / Vuls</h4>

                <Card>
                    <Card.Header as="h5">
                        {caseInfo && caseInfo.status === "Pending" &&
                         <Alert variant="warning">This case is currently in <b>Pending</b> state.</Alert>
                        }
			<>
                            {error.msg &&
                             <Alert variant={error.variation}>{error.msg}</Alert>
                            }
                        </>
			<div className="d-flex align-items-start justify-content-between mt-2 gap-5">
                            <Searchbar
				onChange={onSearchbarChange}
				value={searchVal}
				placeholder="Filter Vulnerabilities"
			    />
                            {reqUser && reqUser.role === "owner" &&
                             <DropdownButton
                                 variant="primary"
                                 title={
                                     <span>Manage <i className="fas fa-chevron-down"></i>
                                     </span>
                                 }
                                 onSelect={handleManage}
                             >
                                 <Dropdown.Item eventKey="add">Add Vul</Dropdown.Item>
				 <Dropdown.Item eventKey="clone">Clone Vul{selectedRows.length>1 && `s`}</Dropdown.Item>
                                 <Dropdown.Item eventKey="remove">Remove Vul</Dropdown.Item>
				 <Dropdown.Item eventKey="edit">{selectedRows.length > 1 && `Bulk`} Edit</Dropdown.Item>
				 <Dropdown.Item eventKey="score">{selectedRows.length > 1 && `Bulk`} Score</Dropdown.Item>
                             </DropdownButton>
                            }
			</div>
                    </Card.Header>
                    <Card.Body>
			{ isLoading ?

			  <div className="text-center">                                                                                                         
                              <div className="lds-spinner"><div></div><div></div><div></div></div>                                                              
			  </div>    
			  :
			  <div className="flex justify-center vuledittable">
                              {reqUser.role === "owner" &&
                               <p className="mb-0">Selected Rows: {selectedRows.length}</p>
                              }
			      
                              <BasicTable
				  columns={cols}
				  data= {filteredData}
				  setSelectedRows = {setSelectedRows}
				  updateMyData = {updateRow}
                              />
			  </div>
			}
                    </Card.Body>
		</Card>

		{reqUser && reqUser.role === "owner" &&
                 <>
                     <EditVulModal
                         showModal={showEditVulModal}
                         hideModal={hideVulModal}
                         vul={editVul}
			 caseInfo={caseInfo}
                         updateVul={doneEdit}
			 modalTitle={modalTitle}
			 bulk={bulk}
			 editVul={editVulNow}
		     />
                     {/*    syncCVE={pullCVEInfo}
                         reserveCVE={preReserveCVE}
                      */}
		     {drfError &&
                      <ErrorModal
			  showModal={displayErrorModal}
			  hideModal={hideErrorModal}
			  message={error.msg}
			  drf={drfError}
                      />  
		     }
		     <ScoreModal
                         showModal = {viewScoreModal}
                         hideModal = {hideScoreModal}
                         vul = {scoreVul}
                     />
		     <DeleteConfirmation
                         showModal={displayConfirmationModal}
                         confirmModal={submitRemoveVul}
                         hideModal={hideConfirmationModal}
                         id={selectedRows}
                         message={deleteMessage} />
		 </>
		}
		
	    </>
	:
	<div className="text-center">
            <div className="lds-spinner"><div></div><div></div><div></div></div>
        </div>
    )

}

export default VulTable;
