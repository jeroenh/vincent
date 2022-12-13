import React, { useState, useEffect, useMemo } from 'react';
import ComponentAPI from './ComponentAPI';
import {Row, Alert, Card, Col, Button, Form, Dropdown, InputGroup, DropdownButton} from 'react-bootstrap';
import ResizableTable from "./ResizableTable";
import '../css/casethread.css';
import DeleteConfirmation from "./DeleteConfirmation";
import ComponentDetailModal from "./ComponentDetailModal";
import {Link, useLocation} from "react-router"
import axios from 'axios';
import AddDependencyModal from "./AddDependencyModal";
import {format} from 'date-fns';

const componentapi = new ComponentAPI();


const Searchbar = ({ onChange, value }) => {
  return (
      <InputGroup className="w-100">
          <Form.Control
              placeholder="Search Dependencies"
              aria-label="Search Components"
              aria-describedby="searchcomponents"
              value={value}
              onChange={onChange}
          />
          <Button variant="btn btn-outline-secondary" id="button-addon2" type="submit">
              <i className="fas fa-search"></i>
          </Button>
      </InputGroup>
  );
};


const ComponentDependencyTable = (props) => {

    const location = useLocation();
    const [data, setData] = useState([]);
    const [error, setError] = useState(null);
    const [count, setCount] = useState(0);
    const [nextUrl, setNextUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRows, setSelectedRows] = useState([]);
    const [searchVal, setSearchVal] = useState("");
    const [addComponentModal, setAddComponentModal] = useState(false);
    const [editComponent, setEditComponent] = useState(null);
    const [cloneComponent, setCloneComponent] = useState(null);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [removeID, setRemoveID] = useState([]);
    const [product, setProduct] = useState(null);
    const [btnDisabled, setBtnDisabled] = useState("disabled");
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [componentDetail, setComponentDetail] = useState(null);
    const [group, setGroup] = useState(null);
    const [showAddDepModal, setShowAddDepModal] = useState(false);

    
    
    const skipPageResetRef = React.useRef()


    const columns = useMemo(
        () => [
	    {
		Header: 'name',
		accessor: 'name',
		Cell: props => (
		    <Link to={`/cvdp/components/${props.row.original.id}`} state={{search: props.search}}>{props.row.original.name}</Link>
		)
	    },
            {
		Header: 'version',
		accessor: 'version',
		Cell: props => (
		    <span>{props.row.original.version}</span>
		)
            },
	    {
		Header: 'owner',
		accessor: 'owner',
	    },
	    {
		Header: 'source',
		accessor: 'source'
	    },
	    {
		Header: 'Added',
		accessor: d=>d.date_added && format(new Date(d.date_added), 'yyyy-MM-dd'),
	    }
	],
        []
    );


    const showDeleteModal = () => {
        /*get selected rows and add them to removeid */
        let rmids = [];
        let rmnames = [];
        selectedRows.map(item => {
	    rmnames.push(item.original.name);
	    rmids.push(item.original.id)
        });
        if (rmnames.length > 0) {
            setRemoveID(rmids);
            setDeleteMessage(<div>Are you sure you want to remove the following dependencies: <ul>{rmnames.map((item, index)=><li key={`rm-${item}`}>{item}</li>)}</ul></div>);
        } else {
            setDeleteMessage("Please select a dependency to remove.");
        }
        setDisplayConfirmationModal(true);
    };


    const submitRemoveComponent = async () => {
	const axiosArray = []

        setError(null);

	removeID.map(item => {
            let data = {'dependency': item, 'remove': 1}
            axiosArray.push(componentapi.addOneDependency(props.component.component.id, data));
        });

        setIsLoading(true);
        let responses = await axios.all(axiosArray).then((response) => {
            setRemoveID([]);
	    fetchInitialData();
        }).catch(err => {
            setError(`Error removing dependency: ${err.response.data.detail}`);
        });

        setDisplayConfirmationModal(false);
    };

    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
	setShowAddDepModal(false);
	fetchInitialData();
    };

    const filterData = (value) => {
        if (value === "") {
	    /* get full data set back */
	    fetchInitialData(value);
        } else {
	    setNextUrl(null);
	    value = encodeURIComponent(value);
	    let query = `search=${value}`;
	    /* stash full data set in filtered data */
	    console.log(query);
	    componentapi.getDependencies(props.component.component.id, query).then((response) => {
		console.log(response);
		if (response.results) {
		    setData(response.results);
		}
		setCount(response.count);
                setNextUrl(response.next);
            }).catch(err => {
		setError({'msg':`Error filtering components: ${err.response.data.detail}`, 'variant': 'danger'});
	    });
        }
    }

    // Searchbar functionality
    const onSearchbarChange = (e) => {
        const value = e.target.value
        setSearchVal(value);
        filterData(value);
    }

    function handleSelectedRows(rows) {
	setSelectedRows(rows);
	if (rows.length > 0 && product) {
	    setBtnDisabled("");
	} else {
	    setBtnDisabled("disabled");
	}
    }

    // Async Fetch
    const fetchInitialData = async (searchParam) => {
        console.log("fetching dependencies");

	await componentapi.getDependencies(props.component.component.id).then((response) => {
	    console.log(response);
	    if (response.results) {
		setData(response.results);
	    }
	    setCount(response.count);
	    setNextUrl(response.next);
            setIsLoading(false);
	    if (searchParam) {
            	filterData(searchParam);
            }
	}).catch(err => {
	    if (err.response?.data) {
		setError({'msg': `Error retrieving components: ${err.response.data.detail}`, 'variant': 'danger'});
	    } else {
		setError({'msg': "Error retrieving components.", 'variant': 'danger'});
	    }
            console.log('Error:', err)
        })
    }

    const fetchNextData = async () => {

	skipPageResetRef.current = true


        await componentapi.getNextComponents(nextUrl).then((response) => {
	    console.log(response);
            setData(data.concat(response.results));
            setCount(response.count);
            setNextUrl(response.next);
	    setIsLoading(false);
        }).catch(err => {
	    setError({'msg': `Error retrieving components: ${err.response.data.detail}`, 'variant': 'danger'});
	    console.log('Error:', err)
        })
    }


    useEffect(() => {
	if (props.component) {
	    console.log(`IN DEP TABLE`);
	    console.log(props.component);
	    fetchInitialData();
	}
    }, [props.component]);

    const fetchMoreData = () => {
	console.log("loading more...");
	if (nextUrl) {
	    fetchNextData();
	}
	setTimeout(() => {

	}, 1500);
    };

    return (
	<Card>
            <Card.Header>
		{selectedRows.length > 0 &&
		 <Alert variant="info">{selectedRows.length} rows selected</Alert>
		}

                <div className="d-flex align-items-start justify-content-between mt-2 gap-5">
                    <Searchbar
			onChange={onSearchbarChange}
			value={searchVal}
		    />

                    <DropdownButton
                        variant="primary"
                        title={
                            <span>Manage Components <i className="fas fa-chevron-down"></i>
                            </span>
                        }
                    >
			<Dropdown.Item eventKey="add" onClick={e=>setShowAddDepModal(true)}>Add Dependency</Dropdown.Item>
                        <Dropdown.Item eventKey="remove" onClick={e=>showDeleteModal()}>Remove Dependency</Dropdown.Item>
			
                    </DropdownButton>
                </div>
            </Card.Header>
            <Card.Body>
		{error &&
		 <Alert variant={error.variant}>{error.msg}</Alert>
		}
		{ isLoading ?
		  <div className="text-center">
                      <div className="lds-spinner"><div></div><div></div><div></div></div>
                  </div>
		  :
		  <ResizableTable columns={columns}
				  data= {data}
				  setSelectedRows = {handleSelectedRows}
				  update={fetchMoreData}
				  showRowExpansion={null}
				  hasMore={nextUrl ? true : false}
				  searchParams = {searchVal}
				  skipPageResetRef = {skipPageResetRef}
		  />
		}
	    </Card.Body>
	    <DeleteConfirmation
                showModal={displayConfirmationModal}
		confirmModal={submitRemoveComponent}
                hideModal={hideConfirmationModal}
                id={removeID}
                message={deleteMessage} />
	    <AddDependencyModal
		showModal = {showAddDepModal}
		hideModal= {hideConfirmationModal}
		component = {props.component.component}
	    />
	</Card>
    )
};

export default ComponentDependencyTable;
