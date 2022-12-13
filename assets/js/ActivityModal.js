import React from 'react';
import { Modal, Alert, Badge, FloatingLabel, Button, InputGroup, Form, Row, Col } from "react-bootstrap";
import { useState, useEffect } from 'react';
import ThreadAPI from './ThreadAPI';
import ActivityApp from './ActivityApp';
import InfiniteScroll from 'react-infinite-scroll-component'

const threadapi = new ThreadAPI();

const ActivityModal = (props) => {
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [caseInfo, setCaseInfo] = useState(null);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [moreLoading, setMoreLoading] = useState(false);
    const [activityHasMore, setActivityHasMore] = useState(false);
    const [activityNext, setActivityNext] = useState(null);
    const [endMessage, setEndMessage] = useState(null);

    const handleSearch = async (event) => {
	if (event) {
	    event.preventDefault();
	}
	setEndMessage(<div className="text-center"></div>);
	setLoading(true);
	await threadapi.searchCaseActivity(props.caseInfo, search).then((response) => {
            setActivity(response.results);

            setActivityNext(response.next);
            if (response.next) {
                setActivityHasMore(true);
            } else {
		setActivityHasMore(false);
	    }

            setLoading(false);
	}).catch(err => {
	    setError(err.response.data.message);
	});

    }

    const fetchMoreActivity = async (page) => {

	setEndMessage(<div className="text-center">No more activity updates</div>);
	setMoreLoading(true);
        await threadapi.getMyActivity(activityNext, search).then((response) => {
	    setActivity(activity.concat(response.results));
	    setActivityNext(response.next);
	    if (response.next) {
                setActivityHasMore(true);
	    } else {
                setActivityHasMore(false);
	    }
	    setMoreLoading(false);
	}).catch(err => {
            console.log(err);
            setError("Error fetching more activity");
        })
    }


    const fetchInitialData = async () => {
        console.log("get case activity");
        await threadapi.getCaseActivity(props.caseInfo).then((response) => {
            setActivity(response.results);
	    setActivityNext(response.next);
            if (response.next) {
                setActivityHasMore(true);
            }
	    setLoading(false);

        }).catch(err => {
            setError(err.response.data.message);
        });
    }

    useEffect(() => {

	setEndMessage(<div className="text-center">No more activity updates</div>);
	if (props.showModal) {
	    setCaseInfo(props.caseInfo);
	    fetchInitialData();
	}

    }, [props.showModal]);


    const checkKeyPress = (e) => {
	/* handle enter to submit */
	const { key, keyCode } = e;
	if (keyCode === 13) {
	    handleSearch();
	}
    };


    return (
        <Modal show={props.showModal} onHide={props.hideModal} size="lg" centered backdrop="static">
            <Modal.Header closeButton className="border-bottom">
		<Modal.Title>Search Case Activity</Modal.Title>
            </Modal.Header>
            <Modal.Body>
		{error &&
		 <Alert variant="danger">{error}</Alert>
		}
		<InputGroup className="w-100">
		    <InputGroup.Text id="basic-addon1"><i className="fas fa-search"></i></InputGroup.Text>
		    <Form.Control
			placeholder="Search for Activity by Keyword or Name"
			aria-label="search"
			aria-describedby="basic-addon1"
			onChange={(e)=>setSearch(e.target.value)}
			onKeyDown={checkKeyPress}
		    />
		    <Button variant="outline-secondary" onClick={(e)=>handleSearch(e)} id="button-addon2">
			Search
		    </Button>

		</InputGroup>
                {loading ?
                 <div className="text-center">
                     <div className="lds-spinner"><div></div><div></div><div></div></div>
                 </div>
                 :
		 <div>
		     {activity.length == 0 &&
		      <p className="mt-3 text-center">No items match the search criteria</p>
		     }
		     <ul className="list-unstyled mb-0 mt-4">
			 {activity.map((a, index) => {
			     return (
				 <li className="p-2 border-bottom" key={`activity-${index}`}>
				     <ActivityApp
					 activity = {a}
				     />
				 </li>
			     )
			 })}
		     </ul>
		     {activityHasMore && !moreLoading &&
		      <div className="text-center">
			  <Button className="mb-3" variant="outline-secondary" onClick={(e)=>fetchMoreActivity()}>Load More</Button>
		      </div>
		     }
		     {moreLoading &&
		      <div className="text-center">
			  <div className="lds-spinner"><div></div><div></div><div></div></div>
		      </div>
		     }
                 </div>
                }
	    </Modal.Body>
        <Modal.Footer className="border-top">
          <Button variant="secondary" onClick={props.hideModal}>
              Return to Case
          </Button>
        </Modal.Footer>
      </Modal>
    )
}

export default ActivityModal;
