import React, { useState, useEffect, useMemo, useRef } from 'react';
import CaseThreadAPI from './ThreadAPI';
import { format, formatDistance } from 'date-fns'
import {Alert,Accordion,  OverlayTrigger, Tooltip, Table, Badge, Card, Row, Col, Dropdown, DropdownButton, Button, Form, InputGroup} from 'react-bootstrap';
import CompStatusTable from './CompStatusTable';
import DeleteConfirmation from "./DeleteConfirmation";
import { useTable, useSortBy, useRowSelect } from 'react-table';
import {useParams, useNavigate, Link, useLocation} from "react-router"
import DropDownCustomEditor from './customDropDownEditor';
import ComponentAPI from './ComponentAPI';
import DisplayVulStatus from './DisplayVulStatus';
import EditStatusModal from './EditStatusModal';
import StatusModal from './StatusModal';
import InfiniteScroll from "react-infinite-scroll-component";

import '../css/casethread.css';

const threadapi = new CaseThreadAPI();
const componentapi = new ComponentAPI();


const STATUS_CHOICES = [
    {val: 0, desc: 'Not Affected'},
    {val: 1, desc: 'Affected'},
    {val: 2, desc: 'Fixed'},
    {val: 3, desc: 'Under Investigation'},
    {val: 4, desc: 'Unknown'},
]


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

    return <textarea rows="1" className="vultable-textarea" value={value} onChange={onChange} onBlur={onBlur} />
}


const DisplayVulStatusSummary = (props) => {

    const {status} = props;

    return (
        <div className="gap-1">
            {status.map((b, index) => {

                return (
                    <DisplayVulStatus
                        key={`${b.status}-${index}`}
                        status={b.status}
                        count = {b.count}
                    />
                )})
            }
        </div>
    )

}

const SORT_CHOICES = [
    {val: 'current_revision__modified', desc: "Most Recent"},
    {val: 'component__product_info__supplier', desc: "Alphabetical by Supplier"},
    {val: 'component__name', desc: "Alphabetical by Component"},
]


const Searchbar = ({ onChange, value }) => {
    return (
	<>
	    <Form.Control
		placeholder="Search Components"
		aria-label="Search Components"
		aria-describedby="searchcomponents"
		value={value}
		onChange={onChange}
            />
            <Button variant="btn btn-outline-secondary" id="button-addon2" type="submit">
		<i className="fas fa-search"></i>
            </Button>
	</>
  );
};


const CaseStatusXls = () => {

    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [error, setError] = useState(null);
    const [searchVal, setSearchVal] = useState("");
    const [vuls, setVuls] = useState([]);
    const [crumbs, setCrumbs] = useState(location.state?.breadcrumbs);
    const [filteredData, setFilteredData] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);
    const [crumbLink, setCrumbLink] = useState(location.state?.crumb_link);
    const [caseInfo, setCaseInfo] = useState(location.state?.caseInfo);
    const [isLoading, setIsLoading] = useState(true);
    const [preFilter, setPreFilter] = useState([]);
    const [data, setData] = useState([]);
    const [showEditStatusModal, setShowEditStatusModal] = useState(false);
    const [editStatus, setEditStatus] = useState(null);
    const [component, setComponent] = useState(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [removeID, setRemoveID] = useState(null);
    const [nextUrl, setNextUrl] = useState(null);
    const [reqUser, setReqUser] = useState(null);


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
                Header: 'Component',
                minWidth: 175,
                Cell: EditableCell,
                accessor: 'component.name',
            },
            {
                Header: 'Supplier',
                Cell: EditableCell,
                accessor: 'component.owner.name',
	    },
	    {
		Header: 'Vul',
		accessor: 'vul.vul',
		Cell: (props) => {
		    const onItemClick = value => {
			console.log("HERE!");
			props.updateMyData(props.row.id, props.column.id, value, props.status);
		    }
		    return (
			    <DropDownCustomEditor
				title="Select Vulnerability"
				options={props.vuls_available}
				selectedValue={props.row.original.vul.vul}
				onItemClick={onItemClick}
			    />
		    )
		},
	    },
	    {
		Header: 'Version',
		Cell: (props) => {
		    console.log(props);
		    return (
			<span onClick={(e)=>console.log("hello")}>{props.row.original.status[props.status].version_value}{props.row.original.status[props.status].version_range}{props.row.original.status[props.status].version_end_range}({props.row.original.status[props.status].version_type})</span>
		    )
		},
		accessor: 'version',
	    },
	    {
		Header: 'Status',
		accessor: 'status',
		Cell: (props) => {
		    const onItemClick = value => {
                        props.updateMyData(props.row.id, "status", value, props.status);
                    }    
		    return (
		    <DropDownCustomEditor
			title="Select Status"
			options={['Not Affected', 'Affected', 'Fixed', 'Under Investigation', 'Unknown']}
			selectedValue={props.row.original.status[props.status].status}
			onItemClick={onItemClick}
		        />
		    )
		    
		},

	    },
	    {
		Header: 'Default Status',
		accessor: 'default_status',
		Cell: (props) => {
		    const onItemClick = value => {
                        props.updateMyData(props.row.id, "default_status", value, null);
                    }
                    return (
			<DropDownCustomEditor
                            title="Select Status"
                            options={['Unknown', 'Affected', 'Not Affected']}
                            selectedValue={props.row.original.default_status}
                            onItemClick={onItemClick}
			/>
                    )
		 },
	    },
	    {
		Header: 'Remediation',
		Cell: EditableCell,
		accessor: 'remediation',
	    }
	],
	[]
    );



    function editStatusNow(c, v) {
	setEditStatus(v);
	setComponent(c);
	setShowEditStatusModal(true);
    }

    function viewStatusDetails(c, v) {
        setEditStatus(v);
        setComponent(c);
        setShowStatusModal(true);
    }

    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    }

    function removeStatus(id) {
        console.log("remove", id);
        setRemoveID(id);
        setDeleteMessage("Are you sure you want to remove this status?");
        setDisplayConfirmationModal(true);
    };

    const submitRemoveStatus = (id) => {
        componentapi.removeStatus(id).then((response) => {
            getSelectedComponents();
        }).catch(err => {
            setErrorMessage(`Error removing component status: ${err.message}. Are you the case owner?`);
            setDisplayErrorModal(true);
            console.log(err);
        });
        setDisplayConfirmationModal(false);
    }

    const filterData = (value) => {

	let sv = encodeURIComponent(value);
        setIsLoading(true);
	if (value) {
            let urlstr = `?search=${sv}`
            getSelectedComponents(urlstr);
	} else {
	    getSelectedComponents(null);
	}

	/*
	if (value === "") {
	    setCaseComponents(preFilter);
        } else {
	    console.log(value);
	    console.log(preFilter);
	    const result = preFilter.filter((item) => {
		return (
		    item.component.name.toString()
			.toLowerCase()
			.indexOf(value.toLowerCase()) > -1
			||
			item.component.owner?.name?.toString()
			.toLowerCase()
			.indexOf(value.toLowerCase()) > -1
		)
            });
	    setCaseComponents(result);
	}*/
    }


    // Searchbar functionality
    const onSearchbarChange = (e) => {
        const value = e.target.value
        setSearchVal(value);
        filterData(value);
    }

    const ActionColumn = (props) => {
        const {component, vulstatus, user} = props;

	return (
	    <div>
                <Button variant="btn-icon px-1 edit-status-btn" onClick={(e)=>editStatusNow(component, vulstatus)}>
                    <i className="fas fa-edit"></i>
                </Button>
                <Button variant="btn-icon px-1 view-status-btn" onClick={(e)=>viewStatusDetails(component, vulstatus)}>
                    <i className="fas fa-search-plus"></i>
                </Button>
                <Button variant="btn-icon px-1 rm-status-btn" onClick={(e)=>removeStatus(vulstatus.id)}>
                    <i className="fas fa-trash"></i>
                </Button>

            </div>

	)
    }

    const hideEditStatusModal = () => {
        setShowEditStatusModal(false);
	getSelectedComponents();
    }

    const hideStatusModal = () => {
	setShowStatusModal(false);
    }



    const updateRow = (rowIndex, columnId, value, statusIndex=null) => {
	
        console.log(`setting data ${columnId} ${statusIndex}`);
	console.log(rowIndex);

	if (columnId === "vul.vul") {
	    console.log(value);
	    setData(old =>
		old.map((row, index) => {
                    if (index === parseInt(rowIndex)) {
			console.log("IN EHRE");
			let r = {
                            ...old[rowIndex],
                            vul: {vul: value},
			}
			console.log(r);
			//postEditVul(r);                                                                                                                  
			return r;
                    }
                    return row
		    
		})
            )
	} else if (statusIndex != null) {
	    setData(old =>
                old.map((row, index) => {
                    if (index === parseInt(rowIndex)) {

			let stat = row['status'];
			if (columnId === "status") {
			    row['status'][statusIndex]["status"] = value;
			}
                        let r = {
                            ...old[rowIndex],
                            status: stat,
                        }
			console.log(r);
			//postEditVul(r);
			return r;
                    }
		    return row
		    
                })
            )

	    

	} else {
	
            setData(old =>
		old.map((row, index) => {
                    if (index === parseInt(rowIndex)) {
			
                    let r = {
                        ...old[rowIndex],
			[columnId]: value,
                    }
			//postEditVul(r);
			return r;
		    }
                    return row
		    
		})
            )
	}
    }


    const getSelectedComponents = async (urlstr) => {
        console.log("fetching case components");
	await componentapi.getCompStatusTable(caseInfo, urlstr).then((response) => {
            console.log("COMP STATUS", response);
	    if (response.results) {
		setData(response.results);
		setNextUrl(response.next);
		setPreFilter(response.results);
	    }
	    setIsLoading(false);
        }).catch(err => {
            console.log('Error:', err)
            if (err.response.status == 403 || err.response.status==404) {
                navigate("../err");
            }

            setError(`Error retrieving component status: ${err.message}`);
	})
    }

    const fetchMoreStatus = async () => {
	console.log("fetching next status");
	await componentapi.getComponentNext(nextUrl).then((response) => {
            console.log("COMP STATUS", response);
	    if (response.results) {
		setData(caseComponents.concat(response.results));
		setNextUrl(response.next);
		setPreFilter(caseComponents.concat(response.results));
	    }
            setIsLoading(false);
	}).catch(err => {
            console.log('Error:', err)
            if (err.response.status == 403 || err.response.status==404) {
                navigate("../err");
            }

            setError(`Error retrieving component status: ${err.message}`);
        })

    };


       // Async Fetch
    const fetchInitialData = async () => {
	if (caseInfo == null) {
            await threadapi.getCase({'case': id}).then((response) => {
		console.log(response);
		setCaseInfo(response);
	    }).catch(err => {
		console.log('Error:', err)
		if (err.response.status == 403 || err.response.status==404) {
                    navigate("../err");
		}

		setError(`Error retrieving component status: ${err.message}`);

	    });
	} else {
	    getSelectedComponents(null);
	}
    }

    function handleSortSelect(evt, evtKey) {
	const urlstr = `?ordering=${evt}`;
	setIsLoading(true);
	getSelectedComponents(urlstr);

    };

    const getVuls = async () => {
	await threadapi.getVuls({'case_id': id}).then((response) => {
	    let v = response.map((vul, id) => vul.vul)
	    console.log(v);
	    setVuls(v);
	}).catch(err => {
	    console.log(err);
	});
    }

    const fetchUser = async () => {
	await threadapi.getUserCaseState({'case': id}).then((response) => {
            console.log("USER IS ", response);
            setReqUser(response);
        })
    }

    useEffect(() => {
	if (caseInfo) {
	    if (reqUser == null) {
		fetchUser();
	    }
	    getSelectedComponents(null);
	    getVuls();
	}
    }, [caseInfo]);

    useEffect(() => {
        fetchInitialData();
    }, []);


    return (
	<>
	    {caseInfo ?
	     <>
		 {crumbs ?

		  <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">{crumbs[0]} /</span> <Link to={crumbLink} >{crumbs[1]}</Link> / <Link to={'..'}>{caseInfo.case_identifier} {caseInfo.title}</Link> / Status</h4>
                      :
                  <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Cases /</span> <Link to={'..'}>{caseInfo.case_identifier} {caseInfo.title}</Link> / Status</h4>
                 }

		 <Card>
		     <Card.Header>
			 <InputGroup>
			     <Searchbar
				 onChange={onSearchbarChange}
				 value={searchVal}
			     />
			     <DropdownButton
				 onSelect={handleSortSelect}
				 variant="outline-primary"
				 title={<i className="fas fa-sort"></i>}
				 id="input-group-dropdown-1"
			     >
				 {SORT_CHOICES.map((choice) => (
                                     <Dropdown.Item eventKey={choice.val} key={choice.val} value={choice.val}>{choice.desc} </Dropdown.Item>
                                 ))}
			     </DropdownButton>
			     <DropdownButton
                                 variant="outline-primary"
                                 title={<i className="fas fa-filter"></i>}
                                 id="input-group-dropdown-2"
                             >                                                                                                                                                         <Dropdown.Item> </Dropdown.Item>
                             </DropdownButton>
			 </InputGroup>

		     </Card.Header>

		     <Card.Body>

			 {isLoading ?
			  <div className="text-center">
			      <div className="lds-spinner"><div></div><div></div><div></div></div>
			  </div>
			  :
			  <div className="flex justify-center vuledittable">
                              {reqUser.role === "owner" &&
                               <p className="mb-0">Selected Rows: {selectedRows.length}</p>
	                      }
			      {vuls &&
                               <CompStatusTable
                                   columns={cols}
                                   data= {filteredData.length > 0 ? filteredData : data}
                                   setSelectedRows = {setSelectedRows}
				   vuls={vuls}
                                   updateMyData = {updateRow}
                               />
			      }
                          </div>
                         }

		     </Card.Body>
		 </Card>
		 <EditStatusModal
		     showModal = {showEditStatusModal}
		     hideModal = {hideEditStatusModal}
		     component = {component}
		     compstatus = {editStatus}
		     user = {reqUser}
		 />
		 <StatusModal
                     showModal = {showStatusModal}
                     hideModal = {hideStatusModal}
                     component = {component}
                     status = {editStatus}
		 />
		 <DeleteConfirmation
                     showModal={displayConfirmationModal}
                     confirmModal={submitRemoveStatus}
                     hideModal={hideConfirmationModal}
		     id={removeID}
                     message={deleteMessage} />
             </>
	     :
	     <></>
	    }
	</>
    )
}

export default CaseStatusXls;
