import React from "react";
import { useState, useEffect, useContext } from 'react';
import {Row, Card, Col, ListGroup} from 'react-bootstrap';
import {useParams, useNavigate, Link, useLocation} from "react-router"
import ComponentDetailInternal from "./ComponentDetailInternal"
import ComponentAPI from './ComponentAPI';
import ActivityApp from './ActivityApp.js';
import {Alert} from "react-bootstrap";
import CompContext from "./CompContext.js";


const ComponentDetail = () => {
    const { id } = useParams();
    const location = useLocation();
    const {user, setUser} = useContext(CompContext);
    const [component, setComponent] = useState(location.state?.component);
    const [error, setError] = useState(null);
    const [activityError, setActivityError] = useState(null);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchParams, setSearchParms] = useState(location.state?.search);
    const navigate = useNavigate();

    const permDenied = (error) => {
	navigate('err');
    }
    
    const fetchComponent = async () => {
	console.log("fetch comp");
	const componentapi = new ComponentAPI(true, permDenied);    
	await componentapi.getComponent(id).then((response) => {
	    if (response?.data) {
		setComponent(response.data);
		setLoading(false);
	    } else {
		console.log("setting error");
		setError("Unable to retrieve component");
	    }
	    
        }).catch(err => {
	    setError(err);
	    console.log(err);
        });
	/* this just resets state on update*/
	//navigate();

    }

    //Async fetch activity
    const fetchActivity = async () => {
	
	const componentapi = new ComponentAPI(true, permDenied);    

        await componentapi.getComponentActivity(component.component).then((response) => {
            setActivity(response.results);
	    console.log(response.results);
            setLoading(false);
        }).catch(err=> {
            setLoading(false);
            setActivityError(err.response.data.detail);
        });
    }

    useEffect(() => {
	console.log(id);
	console.log(location);
	if (!component){
	    fetchComponent();
	}

    }, [])

    useEffect(() => {
	console.log("id has changed");
	console.log(location);
	fetchComponent();
    }, [id]);
    
    useEffect(() => {
	if (component) {
	    setLoading(true);
	    fetchActivity();
	    document.title = `VINCE-NT Component ${component.component?.name}`;
	}
    }, [component]);

    return (
	<>
            <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Components /</span> <Link to="/cvdp/components/" state={{search: searchParams, filter: location.state?.filters}}>Component List</Link> /
		{location.state?.previous?.name &&
		 <>
		     <Link to={`/cvdp/components/${location.state.previous.id}/`}>{location.state.previous.name} </Link>
		     /
		 </>
		}
		{component ?
		 <>
		     {component.component.parent ?
		      `${component.component.name}`
		      :
		      `${component.component.name} ${component.component.version}`
		     }
		 </>
		 :
		 `Component Detail`
		}
	    </h4>
	{component ?
	    <Row>
		 <Col lg={9}>
		     <ComponentDetailInternal
			 component={component}
			 loadactivity = {false}
			 updateComponent={fetchComponent}
		     />
		 </Col>
		 <Col lg={3}>
		     <Card>
			 <Card.Header as="h5" className="mb-0 pb-0">
                             <Card.Title>Recent Activity</Card.Title>
			 </Card.Header>
			 <Card.Body className="p-1">
			     {loading ?
			      <div className="text-center"><div className="lds-spinner"><div></div><div></div><div></div></div></div>
			      :
			      <>
				  {activityError ?
				   <Alert variant="danger">{activityError}</Alert>
				   :
				   <ListGroup variant="flush">
                                       {activity.length == 0 &&
					<ListGroup.Item>No activity</ListGroup.Item>
				       }
				       {activity.map((a, index) => {
					   return (
					       <ListGroup.Item className="p-2 border-bottom" key={`activity-${index}`}>
						   <ActivityApp
						       activity = {a}
						   />
					       </ListGroup.Item>
					   )
				       })}
				   </ListGroup>
				  }
			      </>
			     }
			 </Card.Body>
		     </Card>
		 </Col>
	     </Row>
	 :
	 <>
	     {error ?
	      <Alert variant="danger">{error}</Alert>
	      :
	      <div className="text-center">
		  <div className="lds-spinner"><div></div><div></div><div></div></div>
	      </div>
	     }
	 </>
	}
	</>
    )

}

export default ComponentDetail;
