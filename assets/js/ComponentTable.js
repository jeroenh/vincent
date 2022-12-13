import React, { useContext, useState, useEffect, useMemo } from 'react';
import CompContext from "./CompContext";
import { format } from "date-fns";
import ComponentAPI from './ComponentAPI';
import {Row, Alert, Card, Col, Button, Form, Dropdown, InputGroup, DropdownButton} from 'react-bootstrap';
import ResizableTable from "./ResizableTable";
import '../css/casethread.css';
import AddComponentModal from './AddComponentModal';
import DeleteConfirmation from "./DeleteConfirmation";
import UploadSBOMModal from './UploadSBOMModal';
import ComponentDetailModal from "./ComponentDetailModal";
import SelectGroupModal from "./SelectGroupModal";
import axios from 'axios';
import {Link, useLocation, useSearchParams } from "react-router"


const componentapi = new ComponentAPI();

const FILTER_CHOICES = [
    {val: '', desc: "All Components"},
    {val: 'my', desc: "My Components"},
    {val: "deps", desc: "My Component Dependencies"},
    {val: 'case', desc: "Case Components"},
    {val: 'deleted', desc: "Removed Components"},
]

const Searchbar = ({ onChange, value }) => {
  return (
      <>
          <Form.Control
              placeholder="Search Components"
              aria-label="Search Components"
              value={value}
              onChange={onChange}
          />
          <Button variant="btn btn-outline-secondary" id="button-addon2" type="submit" title="Search Components">
              <i className="fas fa-search"></i>
          </Button>
      </>
  );
};


const ComponentTable = (props) => {

    const location = useLocation();
    let [searchParams, setSearchParams] = useSearchParams();
    const [shiftPressed, setShiftPressed] = useState(false);
    const {user, setUser, loading } = useContext(CompContext);
    const [data, setData] = useState([]);
    const [error, setError] = useState(null);
    const [count, setCount] = useState(0);
    const [urlStr, setUrlStr] = useState("");
    const [controller, setController] = useState(null);
    const [nextUrl, setNextUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [lastSelected, setLastSelected] = useState(null);
    const [selectedRows, setSelectedRows] = useState([]);
    const [searchVal, setSearchVal] = useState(location.state?.search ? location.state.search : "");
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
    const [filters, setFilters] = useState(location.state?.filter ? location.state.filter : "my");
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [multiSelectRows, setMultiSelectRows] = useState({});
    const [sort, setSort] = useState({ direction: "none", accessor: "none" });
    
    const skipPageResetRef = React.useRef()


    const hideUploadModal = () => {
        setShowUploadModal(false);
    };

    

    const columnHeaderClick = async (column) => {
        switch (sort.direction) {
        case "ASC":
                setSort({ direction: "DESC", accessor: column.id });
                sortData(column.id, "DESC");
                setSearchParams((searchParams) => {
                    searchParams.set("ordering", `-${column.id}`);
                    return searchParams;
                });

                break;
            case "DESC":
                setSort({ direction: "none", accessor: column.id });
                sortData(null, "none");
                searchParams.delete("ordering");
                setSearchParams(searchParams);

            break;
        case "none":
        default:
            setSort({ direction: "ASC", accessor: column.id });
            sortData(column.id, "ASC");
            setSearchParams((searchParams) => {
                searchParams.set("ordering", column.id);
                return searchParams;
            });
            break;

        }
    };

    function submitFile(data) {

	setIsLoading(true);
	let group = props.group ? props.group : null;
	if (data['group']) {
	    group = data['group'];
	}
	    
        componentapi.loadSPDX(data, group).then((response) => {
	    compileUrlStr();
	    setIsLoading(false);
        }).catch(err => {
	    console.log(err);
	    setError({'msg': `Error uploading SBOM file: ${err.message} ${err.response?.data?.error}`, 'variant': 'danger'});
	    setIsLoading(false);
	});

        hideUploadModal();
    }


    const initParams = (params) =>
        params.reduce((acc, curr) => {
            const arr = curr.values.map((x) => [curr.name, x]);
            return acc.concat(arr);
        }, []);
    
    const columns = useMemo(
        () => [
            /*{
		id: "selection",
		// The header can use the table's getToggleAllRowsSelectedProps method
		// to render a checkbox
		Header: ({ getToggleAllRowsSelectedProps }) => (
                    <div>
			<input type="checkbox" {...getToggleAllRowsSelectedProps()} />
                    </div>
		),
		// The cell can use the individual row's getToggleRowSelectedProps method
		// to the render a checkbox
		Cell: ({ row }) => (
                    <div>
			<input type="checkbox" {...row.getToggleRowSelectedProps()} />
                    </div>
		),
		width: 50,
		disableSizing: true,
	    },*/
	    {
		Header: 'name',
		accessor: 'name',
		id: 'component__name',
		Cell: props => (
		    <Link to={`/cvdp/components/${props.row.original.component.id}`} state={{component: props.row.original, search: props.search, user: user}}>{props.row.original.component.name}</Link>
		)
	    },
            {
		Header: 'versions',
		accessor: 'versions',
		Cell: props => (
		    <span>{props.row.original.versions.length}</span>
		)
            },
	    {
		Header: 'owner',
		accessor: 'owner.name',
		id: 'supplier__name',
		Cell: props => (
			props.row.original.owner ?
			<a href={`${props.row.original.owner.url}`}>{props.row.original.owner.name}</a>
		    :
		    ""
		)

	    },
	    {
		Header: 'type',
		accessor: 'component.component_type',
	    },
	    {
		Header: 'supplier',
		id: 'component__supplier',
		accessor: 'component.supplier'
	    },
	    {
		Header: 'source',
		accessor: 'component.source'
	    },
	    {
		Header: 'comment',
		accessor: 'component.comment'
	    },
	    {
		Header: 'Last Modified',
		id: 'component__modified',
		accessor: (d) =>
                    d.component.modified &&
                    format(new Date(d.component.modified), "yyyy-MM-dd HH:mm"),
	    },
		
	    /*{
		Header: 'Contained in',
		accessor: 'contained_in',
		Cell: props => (
		    <span>{props.row.original.component.contained_in.length}</span>
		)
	    },*/
	    /*{
		Header: 'Dependencies',
		id: 'expander',
		accessor: 'dependencies',
		Cell: props => (
		    // Use Cell to render an expander for each row.
		    // We can use the getToggleRowExpandedProps prop-getter
		    // to build the expander.
		    <>

			{props.row.original.dependencies > 0 ?
			 <span {...props.row.getToggleRowExpandedProps()}>
			     {props.row.isExpanded ?
			      <Button variant="secondary" size="xs"><i className="fas fa-angle-down"></i>  Hide</Button> : <Button variant='secondary' size="xs"><i className="fas fa-angle-right"></i>  Show {props.row.original.dependencies}  </Button>}
			 </span>
			 :
			 <>
			     0{" "}<Button variant="btn-icon px-1" title="Add Dependencies" onClick={() => addDeps(props.row)}><i className="fas fa-plus"></i></Button>
			 </>
			}
		    </>
		),
	    },*/
	    {
		Header: 'Action',
		accessor: 'action',
		Cell: props => (
		    <div className="text-nowrap">
			{props.row.original.permissions == "rw" &&
			 <Button title="Edit Component" variant="btn-icon px-1" onClick={() => handleShow(props)}>
			 <i className="fas fa-edit"></i></Button>
			}
			<Button title="View Details" variant="btn-icon px-1" onClick={() => viewDetails(props)}><i className="fas fa-search-plus"></i></Button>
			{props.row.original.permissions == "rw" &&
			 <Button variant="btn-icon px-1" title="Clone Component" onClick={()=>handleCloneComponent(props)}><i className="fas fa-clone"></i></Button>
			}
		    </div>
		)
	    }
        ],
        []
    );

    const addDeps = (row) => {
	setProduct(row.original.component);
	window.scrollTo(0, 0)
    };

    const handleCloneComponent = (props) => {
	setCloneComponent(props.row.original);
    };

    const showDeleteModal = () => {
        /*get selected rows and add them to removeid */
        let rmids = [];
        let rmnames = [];
        selectedRows.map(item => {

	    if (item.original.versions.length > 1) {
		item.original.versions.map(v => {
		    rmnames.push(`${item.original.component.name} ${v.version}`)
		    rmids.push(v.id)
		});
	    } else {
		rmnames.push(item.original.component.name);
		rmids.push(item.original.component.id)
	    }
        });
        if (rmnames.length > 0) {
            setRemoveID(rmids);
            setDeleteMessage(<div>Are you sure you want to remove the following components: <ul>{rmnames.map((item, index)=><li key={`rm-${item}`}>{item}</li>)}</ul></div>);
        } else {
            setDeleteMessage("Please select a component to remove.");
        }
        setDisplayConfirmationModal(true);
    };


    const submitRemoveComponent = () => {
        componentapi.removeComponents(removeID).then((response) => {
	    setError({'msg':`Got it! ${removeID.length} items successfully removed.`, 'variant': 'success'});
	    compileUrlStr();

        }).catch(err => {
	    setError({'msg': `Error removing components: ${err.response.data.detail}`, 'variant': 'danger'});
	})
        setDisplayConfirmationModal(false);
    };

    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    };

    const hideDetailModal = () => {
	setShowDetailModal(false);
    };

    const handleShow = (props) => {
	console.log(props.row.original.id);
	setEditComponent(props.row.original);
    };

    const viewDetails = (props) => {
	setComponentDetail(props.row.original);
	setShowDetailModal(true);
	console.log("view details of component");
    };

    
    const fetchUser = async () => {

	await componentapi.getUser().then(response => {
	    setUser(response);
	});
    }
    

    useEffect(() => {
	if (!user) {
	    fetchUser();
	}
    }, []);
    
    
    useEffect(() => {
	if (editComponent || cloneComponent) {
	    setAddComponentModal(true);
	}
    }, [editComponent, cloneComponent]);

    const hideComponentModal = () => {
        setAddComponentModal(false);
	setEditComponent(null);
	setCloneComponent(null);
        filterData(urlStr);
    };

    const hideGroupModal = () => {
	setShowGroupModal(false);
	compileUrlStr();
    };

    const filterData = (query) => {
        const newcontrol = new AbortController();
        setController(newcontrol);

        /* do something to filter */
        if (controller) {
            controller.abort();
        }
	
        if (query === "") {
	    /* get full data set back */
	    fetchInitialData(query);
        } else {
	    setNextUrl(null);
	    /* stash full data set in filtered data */
	    if (props.group) {
		componentapi.getGroupComponents(props.group, query, newcontrol.signal).then((response) => {
		    if (response.results) {
			setData(response.results);
		    }
		    setCount(response.count);
                    setNextUrl(response.next);
                }).catch(err => {
		    if (axios.isCancel(err)) {
		    } else {
			setError({'msg':`Error filtering components: ${err.response.data.detail}`, 'variant': 'danger'});
		    }
		});
	    } else {
		componentapi.getComponents(query, newcontrol.signal).then((response) => {
		    if (response.results) {
			setData(response.results);
		    }
		    setCount(response.count);
                    setNextUrl(response.next);

		}).catch(err => {
		    if (axios.isCancel(err)) {

		    } else {
			console.log(err);
			setError({'msg': `Error filtering components: ${err.response.data.detail}`, 'variant': 'danger'}) ;
		    }
		})
	    }
        }
    }


    const sortData = async (column, direction) => {
        setIsLoading(true);
        if (controller) {
            controller.abort();
        }
        const newcontrol = new AbortController();
        setController(newcontrol);

	if (props.group) {
            componentapi.sortGroupComponents(props.group, column, direction, urlStr, newcontrol.signal).then((response) => {
                if (response.results) {
                    setData(response.results);
                }
		setIsLoading(false);
                setCount(response.count);
                setNextUrl(response.next);
	    }).catch(err => {
                setError({'msg':`Error filtering components: ${err.response.data.detail}`, 'variant': 'danger'});
            });
        } else {
            componentapi.sortComponents(column, direction, urlStr, newcontrol.signal).then((response) => {
                if (response.results) {
		    setData(response.results);
                }
		setIsLoading(false);
                setCount(response.count);
                setNextUrl(response.next);
		
	    }).catch(err => {
                setError({'msg': `Error filtering components: ${err.response.data.detail}`, 'variant': 'danger'}) ;
	    })
        }
	
    };
    
    function handleManage(evt, evtKey) {
        switch(evt) {
        case 'add' :
            setAddComponentModal(true);
            return;
        case 'remove':
            showDeleteModal();
            return;
        case 'owner':
	    setShowGroupModal(true);
            return;
	case 'upload':
	    setShowUploadModal(true);
	    return;
	default:
	    return;
        }
    };

    // Searchbar functionality
    const onSearchbarChange = (e) => {
        const value = e.target.value
	if (value) {
	    setSearchVal(e.target.value);
	} else {
	    setSearchVal("");
	}
    }

    function filterComponents(evt, evtKey) {
        setFilters(evt);
    }


    const compileUrlStr = () => {
	let urlstr = "";
	const params = [];
	
	if (searchVal) {
	    let q = encodeURIComponent(searchVal);	    
	    urlstr = `search=${q}`;
	    params.push({name: "search", values:[q]});
	}

	if (filters) {
	    urlstr = urlstr.concat(`&${filters}=1`);
	    params.push({ name: filters, values: [1]});
	    
	}

	const test = initParams(params);
        const sps = new URLSearchParams(initParams(params));

	setSearchParams(sps);
	setUrlStr(sps.toString());
	    
    }

    useEffect(() => {
	
	if (filters && !urlStr) {
	    return;
	} 

	filterData(urlStr);
    }, [urlStr]);
    
    useEffect(() => {
	
	compileUrlStr();
	
    }, [filters, searchVal]);

    function handleSelectedRows(rows) {

	let newrows = rows;

	
	let lastselected = rows.find(x => !selectedRows.includes(x));

	if (lastselected) {
	    lastselected.original.isSelected = !lastselected.original.isSelected;
	}
	/*
	if (shiftPressed && lastSelected && lastselected) {
	    let greater = Math.max(lastSelected.id, lastselected.id);
	    let lesserval = greater == lastSelected.id ? lastselected.id : lastSelected.id;
	    let addrows = []
	    for (let i = lesserval; i < greater; i++) {
		data[i].isSelected = true;
		addrows.push(data[i])
	    }
	    newrows = newrows.concat(addrows);
	    console.log(newrows);
	    
	} 
	*/  
	if (lastselected) {
	    setLastSelected(lastselected);
	}
	
	setSelectedRows(newrows);
	
	if (rows.length > 0 && product) {
	    setBtnDisabled("");
	} else {
	    setBtnDisabled("disabled");
	}
    }


    const handleKeyDown = (event) => {
	if (event.key === 'Shift') {
	    setShiftPressed(true);
	}
    };
    
    const handleKeyUp = (event) => {
	if (event.key === 'Shift') {
	    setShiftPressed(false);
	}
    };
    
    useEffect(() => {
	window.addEventListener('keydown', handleKeyDown);
	window.addEventListener('keyup', handleKeyUp);
	
	return () => {
	    window.removeEventListener('keydown', handleKeyDown);
	    window.removeEventListener('keyup', handleKeyUp);
	};
    }, []);
    
    const submitDependencies = async () =>{
	const axiosArray = []

	setError(null);

	selectedRows.map(item => {
	    let data = {'dependency': item.original.component.id}
	    axiosArray.push(componentapi.addOneDependency(product.id, data));
	});

	try {
	    await axios.all(axiosArray);
	    setProduct(null)
	    setSelectedRows([]);
	    setSearchVal("");
	    setError({'msg': `Successfully added ${selectedRows.length} dependencies`, 'variant': 'success'});
	} catch(err) {
	    setError({'msg': `Error adding dependency: ${err.response.data.detail}`, 'variant': 'danger'});
	};
    }

    // Async Fetch
    const fetchInitialData = async (searchParam) => {
        console.log("fetching components");

        try {
	    if (props.group) {
		await componentapi.getGroupComponents(props.group).then((response) => {
		    if (response.results) {
			setData(response.results);
		    }
		    setCount(response.count);
		    setNextUrl(response.next);
                    setIsLoading(false);
		    if (searchParam) {
			filterData(searchParam);
		    }

		})
	    } else {
		await componentapi.getComponents().then((response) => {
		    if (response.results) {
			setData(response.results);
		    }
		    setCount(response.count);
		    setNextUrl(response.next);
                    setIsLoading(false);
		    if (searchParam) {
            		filterData(searchParam);
                    }
		})
	    }
        } catch (err) {
	    if (err.response?.data) {
		setError({'msg': `Error retrieving components: ${err.response.data.detail}`, 'variant': 'danger'});
	    } else {
		setError({'msg': "Error retrieving components.", 'variant': 'danger'});
	    }
            console.log('Error:', err)
        }
    }

    const fetchNextData = async () => {

	skipPageResetRef.current = true

	try {
            if (props.group) {
	        await componentapi.getNextGroupComponents(nextUrl).then((response) => {
                    console.log(response);
                    setData(data.concat(response.results));
		    setCount(response.count);
		    setNextUrl(response.next);
                    setIsLoading(false);
                })
            } else {
                await componentapi.getNextComponents(nextUrl).then((response) => {
		    console.log(response);
                    setData(data.concat(response.results));
                    setCount(response.count);
                    setNextUrl(response.next);
	            setIsLoading(false);
                })
            }
        } catch (err) {
	    setError({'msg': `Error retrieving components: ${err.response.data.detail}`, 'variant': 'danger'});
	    console.log('Error:', err)
        }
    }

    const fetchMoreData = () => {
	console.log("loading more...");
	if (nextUrl) {
	    fetchNextData();
	}
	setTimeout(() => {

	}, 1500);
    };

    const DisplayDependencies = (props) => {
	console.log(props);
	return (
	    props.dependencies.map((d, index) => {
		return (
		    <h5>{d}</h5>
		)
	    })
	)
    }

    async function getDependencies(id) {
	const response = await componentapi.getDependencies(id);
	return response.dependencies.map(item => item.name)
    }

    function SubRows({ row, rowProps, visibleColumns, data, loading }) {
	if (loading) {
	    return (
		<tr>
		    <td colSpan={visibleColumns.length}>
			<b>Loading...</b>
		    </td>
		</tr>

	    );
	}

	// error handling here :)
	//
	return (
	    <>
		{data.map((x, i) => {
		    return (
			<tr key={`${rowProps.key}-expanded-${i}`} className="text-center">
			    <td colSpan={visibleColumns.length} className="text-center noborder">
				<Link to={`/cvdp/components/${x.id}`} state={{search: props.search, filter: filter}}>{x.name} {x.version}</Link>
			    </td>
			</tr>
		    );



		})}
		<tr key={`${rowProps.key}-expanded-addmore`} className="text-center border-bottom">
                    <td colSpan={visibleColumns.length} className="text-center noborder">
			<Button variant="primary" size="xs" className="p-1" title="Add Dependencies" onClick={() => addDeps(row)}><i className="fas fa-plus"></i> Add Dependencies</Button>
                    </td>
                </tr>
	    </>
	);
    }

    useEffect(() => {
	// After the table has updated, always remove the flag
	skipPageResetRef.current = false
    }, [data])

    function SubRowAsync({ row, rowProps, visibleColumns }) {
	const [loading, setLoading] = React.useState(true);
	const [data, setData] = React.useState([]);

	useEffect(() => {
	    const timer = setTimeout(() => {
		componentapi.getDependencies(row.original.component.id).then((response) => {
		    setData(response.results);
		    setLoading(false);
		});
	    }, 500);

	    return () => {
		clearTimeout(timer);
	    };
	}, []);

	return (
	    <SubRows
		row={row}
		rowProps={rowProps}
		visibleColumns={visibleColumns}
		data={data}
		loading={loading}
	    />
	);
    }

    function SubRowSync({row, rowProps, visibleColumns}) {
	console.log(row.original.dependencies);
	return (
            <SubRows
                row={row}
                rowProps={rowProps}
                visibleColumns={visibleColumns}
                data={row.original.dependencies}
                loading={false}
            />
        );
    }


    // Create a function that will render our row sub components
    const showDeps = React.useCallback(
	({ row, rowProps, visibleColumns }) => (
	    <SubRowAsync
		row={row}
		rowProps={rowProps}
		visibleColumns={visibleColumns}
	    />
	),
	[]
    );

    return (
	<>
	    {props.group ? ""
	     :
	     <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Components /</span> Component List</h4>
	    }
	    <Card>
            <Card.Header className="pb-0">
		{product ?

		 <Alert variant="warning">
		     <div className="d-flex align-items-start gap-4">
		     <Card.Title>Adding dependencies for <b>{product.name}</b></Card.Title>
			 <Button variant="secondary" onClick={(e)=>setProduct(null)}>Cancel</Button>
		     </div>
		 </Alert>

		 : ""
		}
		{selectedRows.length > 0 &&
		 <Alert variant="info">{selectedRows.length} rows selected</Alert>
		}

                <div className="d-flex align-items-start justify-content-between mt-2 gap-5">
		    <InputGroup>
			<Searchbar
			    onChange={onSearchbarChange}
			    value={searchVal}
			/>
			<DropdownButton
			    onSelect={filterComponents}
			    variant="outline-primary"
			    title={<i title="filter by" className="fas fa-filter"></i>}
			    id="input-group-dropdown-1">

			    {FILTER_CHOICES.map((choice) => (
				<Dropdown.Item eventKey={choice.val} key={choice.val} value={choice.val} active={filters==choice.val}>{choice.desc} </Dropdown.Item>
                            ))}  
			</DropdownButton>
		    </InputGroup>

		    {product ?
		     <Button variant="primary" onClick={(e)=>submitDependencies()} disabled={btnDisabled}>Submit Dependencies</Button>
		     :
		     <>
			 {user && user.groupadmin &&
			  
			  <DropdownButton
                              variant="primary"
                              title={
				  <span>Manage Components <i className="fas fa-chevron-down"></i>
				  </span>
                              }
			      onSelect={handleManage}
			  >
			      
			      <Dropdown.Item eventKey="add">Add Component</Dropdown.Item>
                              <Dropdown.Item eventKey="remove">Remove Component</Dropdown.Item>
			      <Dropdown.Item eventKey="upload">Upload SBOM (SPDX)</Dropdown.Item>
			      {/*<Dropdown.Item eventKey="merge">Merge Components</Dropdown.Item>*/}
			      {props.group ? "" :
			       <>
				   {user && user.roles.length > 0 &&
				    <Dropdown.Item eventKey="owner">Add Component Owner</Dropdown.Item>
				   }
			       </>
			      }
			  </DropdownButton>
			 }
		     </>
		    }
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
				  showRowExpansion={showDeps}
				  hasMore={nextUrl ? true : false}
				  searchParams = {searchVal}
				  selectedRows={multiSelectRows}
				  skipPageResetRef = {skipPageResetRef}
				  sort={sort}
				  onHeaderClick={
				      columnHeaderClick
				  }
		  />
		}
	    </Card.Body>

	    <AddComponentModal
		showModal = {addComponentModal}
		hideModal = {hideComponentModal}
		title = {editComponent? "Edit Component" : "Add Component"}
		edit = {editComponent}
		group = {props.group}
		clone = {cloneComponent}
		user={user}
	    />
		
	    <DeleteConfirmation
                showModal={displayConfirmationModal}
		confirmModal={submitRemoveComponent}
                hideModal={hideConfirmationModal}
                id={removeID}
                message={deleteMessage} />
	    <ComponentDetailModal
		showModal = {showDetailModal}
		hideModal = {hideDetailModal}
		id = {componentDetail}
	    />
		{user &&
		 <UploadSBOMModal
		     showModal = {showUploadModal}
                     hideModal = {hideUploadModal}
                     confirmModal = {submitFile}
		     user={user}
		 />
		}
	    {props.group ? "" :
	     <SelectGroupModal
		 showModal = {showGroupModal}
		 hideModal = {hideGroupModal}
		 selected= {selectedRows}
	     />
	    }

	    </Card>
	</>
    )
};

export default ComponentTable;
