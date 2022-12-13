import React, { useState, useEffect, useCallback } from "react";
import { Card, DropdownButton, Dropdown, Alert, Form, Button, Row, Col } from "react-bootstrap";
import CaseThreadAPI from "./ThreadAPI";
import DeleteConfirmation from "./DeleteConfirmation";
import AdminAPI from "./AdminAPI";
import ContactAPI from "./ContactAPI.js";
import DisplayLogo from "./DisplayLogo";
import { AsyncTypeahead } from "react-bootstrap-typeahead";
import "react-bootstrap-typeahead/css/Typeahead.bs5.css";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "../css/casethread.css";

const threadapi = new CaseThreadAPI();
const adminapi = new AdminAPI();
const contactapi = new ContactAPI();

const CACHE = {};
const PER_PAGE = 50;

function makeAndHandleRequest(query, page = 1) {
    let urlstr = "type=group";
    if (query) {
        urlstr = `${urlstr}&name=${query}`;
    }
    return contactapi.searchGroups(urlstr).then((response) => {
        let items = response.results;
	console.log(response);
        let total_count = items.length;
        const options = items.map((i) => ({
            name: i.name,
            uuid: i.uuid,
            color: i.logocolor,
            logo: i.photo,
        }));
        console.log(options);
        return { options, total_count };
    });
}

const CoordTeamApp = (props) => {
    const [showForm, setShowForm] = useState(false);
    const [query, setQuery] = useState("");
    const [error, setError] = useState({'variant': '', 'msg': ''});
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [displayConfirmationModal, setDisplayConfirmationModal] =
          useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [invalidGroup, setInvalidGroup] = useState(false);
    const [teams, setTeams] = useState([]);
    const [removeID, setRemoveID] = useState(null);

    const [group, setGroup] = useState([]);

    const handleInputChange = (q) => {
        setQuery(q);
    };

    const handleSearch = useCallback((q) => {
        if (CACHE[q]) {
            setOptions(CACHE[q].options);
            return;
        }

        setIsLoading(true);
        makeAndHandleRequest(q).then((resp) => {
            CACHE[q] = { ...resp, page: 1 };
            console.log("OPTIONS ARE>>>>>>>", resp.options);
            setIsLoading(false);
            setOptions(resp.options);
        });
    }, []);

    const handlePagination = (e, shownResults) => {
        const cachedQuery = CACHE[query];

        // Don't make another request if:
        // - the cached results exceed the shown results
        // - we've already fetched all possible results
        if (
            cachedQuery.options.length > shownResults ||
            cachedQuery.options.length === cachedQuery.total_count
        ) {
            return;
        }

        setIsLoading(true);

        const page = cachedQuery.page + 1;

        makeAndHandleRequest(query, page).then((resp) => {
            const options = cachedQuery.options.concat(resp.options);
            CACHE[query] = { ...cachedQuery, options, page };

            setIsLoading(false);
            console.log("OPTIONS ARE, options");
            setOptions(options);
        });
    };

    const fetchInitialData = async () => {
        try {
            contactapi.getCoordTeams().then((response) => {
                console.log(response);
                setTeams(response);
		setLoading(false);
            });
        } catch (err) {
            console.log(err);
            setError({'variant': 'danger', 'msg': `Error retrieving coordination teams: ${err.message}`});
        }
    };


    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    };

    const submitRemoveCoordTeam = (id) => {
        contactapi
            .removeCoordTeam(id)
            .then((response) => {
		setError({'variant': 'success', 'msg': 'Coordination team successfully removed.'});
                fetchInitialData();
            })
            .catch((err) => {
                setError({'variant': 'danger', 'msg': `Error removing coordination team : ${err.message}`});
            });
        setDisplayConfirmationModal(false);
    };
    
    const submitCoordTeam = (event) => {
        event.preventDefault();
        const error = false;
        const formData = new FormData(event.target),
            formDataObj = Object.fromEntries(formData.entries());

	if (group == "" || group.length == 0) {
	    setInvalidGroup(true);
	    return;
	}

	formDataObj["group"] = group[0].uuid;

	console.log(formDataObj);

	contactapi.addCoordTeam(formDataObj).then((response) => {
	    setShowForm(false);
	    setGroup("");
	    fetchInitialData();
	    setError({'variant': 'success', 'msg': 'Coordination team successfully added.'});
	}).catch((err) => {
	    console.log(err);
	    setError({'variant': 'danger', 'msg': `Error adding coordination team: ${err.message}`});
	});
    }


    useEffect(() => {

        fetchInitialData();
    }, []);

    return (
        <Card className="mb-4">
            <Card.Header as="h5" className="d-flex justify-content-between">
                <Card.Title>Coordination Teams</Card.Title>
                <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setShowForm(true)}
                >
                    Add Team
                </Button>
            </Card.Header>
            <Card.Body>
		{error.msg &&
		 <Alert variant={error.variant}>{error.msg}</Alert>
		}
                {showForm && (
                    <Card className="mb-3">
                        <Card.Header as="h5">
                            <Card.Title>New Coordination Team</Card.Title>
                        </Card.Header>
                        <Card.Body>
                            <Form onSubmit={(e) => submitCoordTeam(e)}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="mb-0">
                                        Group
                                    </Form.Label>
                                    <AsyncTypeahead
                                        id="group"
                                        options={options}
                                        isLoading={isLoading}
                                        onPaginate={handlePagination}
                                        onSearch={handleSearch}
                                        paginate
                                        defaultSelected={group}
                                        onChange={setGroup}
                                        onInputChange={handleInputChange}
                                        labelKey="name"
                                        isInvalid={invalidGroup}
                                        placeholder="Search for a group"
                                        renderMenuItemChildren={(option) => (
                                            <div className="d-flex align-items-center gap-2">
                                                <DisplayLogo
                                                    name={option.name}
                                                    photo={option.logo}
                                                    color={option.color}
                                                />
                                                <span className="participant">
                                                    {option.name}
                                                </span>
                                            </div>
                                        )}
                                        useCache={false}
                                    />
                                    {invalidGroup && (
                                        <Form.Text className="error">
                                            This field is required.
                                        </Form.Text>
                                    )}
                                </Form.Group>
                                <div className="d-flex align-items-center gap-3">
                                    <Button
                                        variant="outline-secondary"
                                        type="cancel"
                                        onClick={(e) => (
                                            e.preventDefault(),
                                            setShowForm(false)
                                        )}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" variant="primary">
                                        Save
                                    </Button>
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                )}

		{loading ?

		  <div className="text-center">
		      <div className="lds-spinner"><div></div><div></div><div></div></div>
                  </div>

                 :
		 <>
                 <Row xs={1} md={2} className="g-4">
                    {teams.map((c, index) => {
                        return (
                            <Col key={`coordteam-${index}`}>
                                <Card>
                                    <Card.Header as="h5" className="d-flex justify-content-between pb-0">
                                        <Card.Title>
                                            <div className="d-flex align-items-center gap-3">
                                                <DisplayLogo
                                                    name={c.name}
                                                    photo={c.photo}
                                                    color={c.logocolor}
                                                />
                                                <div>
                                                    {c.name} Coordination
                                                    Team
                                                </div>
                                            </div>
                                        </Card.Title>
                                        <DropdownButton
                                            variant="btn p-0"
                                            title={
                                                <i className="bx bx-dots-vertical-rounded" title="Manage team"></i>
                                            }
                                        >
                                            <Dropdown.Item
                                                eventKey="rm"
                                                onClick={(e) => {
                                                    setRemoveID(c.uuid),
                                                    setDeleteMessage(
                                                        "Are you sure you want to remove this coordination team? This will not remove the group from the platform but will remove their \"Coordinator\" access status."
                                                    ),
                                                    setDisplayConfirmationModal(
                                                        true
                                                    );
                                                }}
                                            >
                                               Remove Team
                                            </Dropdown.Item>
                                           
                                        </DropdownButton>


                                    </Card.Header>
                                    <Card.Body>
					{c.lead &&
					 <Card.Subtitle className="mb-2"><i className="fas fa-crown"></i>  Lead Coordination Team</Card.Subtitle>
					}

					<p className="lead"><a href={c.url}>Team Profile</a></p>
					<p className="lead"><a href={`/cvdp/triage/calendar/?team=${c.name}`}>Team Triage Calendar</a></p>
					

				    </Card.Body>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
		 <DeleteConfirmation
                    showModal={displayConfirmationModal}
                    confirmModal={submitRemoveCoordTeam}
                    hideModal={hideConfirmationModal}
                    id={removeID}
                    message={deleteMessage}
                 />
		 </>
               }
            </Card.Body>
        </Card>
    );
};

export default CoordTeamApp;
