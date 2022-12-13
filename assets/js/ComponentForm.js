import React from 'react';
import { Row, Col, Modal, Tabs, Alert, Badge, Button, Form, Tab } from "react-bootstrap";
import { useContext, useState, useEffect } from 'react';
import ComponentAPI from './ComponentAPI.js'
import ContactAPI from './ContactAPI';
import axios from 'axios';
import ComponentTypeahead from './ComponentTypeahead';
import GroupTypeahead from './GroupTypeahead';
import TagTypeahead from './TagTypeahead';
import CompContext from "./CompContext";

const componentapi = new ComponentAPI();
const contactapi = new ContactAPI();


const EXTERNAL_ID_TYPES = ['purl', 'cpe', 'swid', 'sbom_id', 'other']

const ComponentForm = (props) => {

    const {user, setUser} = useContext(CompContext);
    const [tags, setTags] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState([]);
    const [versions, setVersions] = useState([""]);
    const [owner, setOwner] = useState([]);
    const [invalidOwner, setInvalidOwner] = useState(false);
    const [componentTypeOptions, setComponentTypeOptions] = useState([]);
    const [compType, setCompType] = useState("");
    const [supplier, setSupplier] = useState("");
    const [homepage, setHomepage] = useState("");
    const [checksum, setChecksum] = useState("");
    const [externalids, setExternalIDs] = useState([{'id_type': 'purl', 'id': ''}])
    const [source, setSource] = useState("");
    const [comment, setComment] = useState("");
    const [groupOptions, setGroupOptions] = useState(null);
    const [formValues, setFormValues] = useState({});

    const [multipleVersions, setMultipleVersions] = useState(true);

    // Async Fetch
    const fetchInitialData = async () => {

	if (!props.group) {
	    await contactapi.getGroups().then((response) => {
		if (response.pages == 1) {
		    setGroupOptions(response.results);
		    if (response.count == 1) {
			/* if only 1, just prepopulate */
			setOwner(response.results);
		    }
		}
	    }).catch(err => {
		setError("Error occurred when retrieving available suppliers.");
	    });
	}

	await componentapi.getComponentOptions().then((response) => {
	    setComponentTypeOptions(response['actions']['POST']['component_type']["choices"]);
	}).catch(err => {
	    setError("Unable to retrieve component options");
	});

    }


    function containsAny(arr1, arr2) {
	console.log(arr1);
	console.log(arr2);
	return arr1.some(item => arr2.indexOf(item) !== -1);
    }

    let handleChange = (i, e) => {
	if (e.target.name == "version") {
	    let newFormValues = [...versions];
	    newFormValues[i] = e.target.value;
	    setVersions(newFormValues);
	} else {
	    let newFormValues = [...externalids];
	    newFormValues[i][e.target.name] = e.target.value;
	    setExternalIDs(newFormValues);
	}
    }

    let addFormFields = (type) => {
	if (type == "version") {
	    setVersions([...versions, ""])
	} else {
	    setExternalIDs([...externalids, {'id_type': 'purl', 'id': ''}])
	}
    }

    let removeFormFields = (i, type) => {
	if (type == "version") {
	    let newFormValues = [...versions];
	    newFormValues.splice(i, 1);
	    setVersions(newFormValues);
	} else {
	    let newFormValues = [...externalids];
            newFormValues.splice(i, 1);
            setExternalIDs(newFormValues);
	}


    }

    useEffect(() => {
	fetchInitialData();
    }, []);

    useEffect(() => {
	console.log(name);
	if (name.length > 0) {
	    if (name[0].hasOwnProperty("versions")) {
		let items = name[0].versions;
		const vs = items.map(item => item.version)
		setVersions(vs);
		if (!props.group) {
		    if (name[0].owner?.name) {
			setOwner([name[0].owner]);
		    }
		}
	    }
	    let newFormValues = formValues;
	    newFormValues["name"] = name[0].name
	    setFormValues(newFormValues);
	    props.update(newFormValues);
	}
    }, [name]);


    useEffect(() => {
	console.log("COMPO FORM")
	console.log(props.initial);
	console.log(user);
	if (props.initial) {

	    if (props.initial.owner) {
		setOwner([props.initial.owner]);
	    } else {
		setOwner([]);
	    }
	    if (props.initial.component) {
		setSupplier(props.initial.component.supplier ? props.initial.component.supplier : "");
		setName([{'name': props.initial.component.name}])
		const vs = props.initial.versions.map(item => item.version)
		setVersions(vs);
		setSource(props.initial.component.source || "");
		setComment(props.initial.component.comment || "");
		setHomepage(props.initial.component.homepage || "");
		setChecksum(props.initial.component.checksum || "");
		setCompType(props.initial.component.component_type);
		setTags(props.initial.component.tags || []);
		if (props.initial.component.external_ids?.length > 0) {
		    const exids = props.initial.component.external_ids.map(item => {
			const exid = Object.entries(item).map(([key, value]) => {
			    return ({'id_type': key, 'id': value})
			});
			if (exid) {
			    return exid[0];
			}
		    });
		    if (exids.length > 0) {
			setExternalIDs(exids);
		    }
		}

		if (!props.initial.component.parent) {
		    setVersions([props.initial.component.version])
		    setMultipleVersions(false);
		}
	    } else {
		/* reset */
		setSupplier("");
		setName([]);
		setVersions([]);
		setExternalIDs([{"id_type": "purl", "id": ""}]);
		setSource("");
		setTags([]);
		setHomepage("");
		setChecksum("");
		setComment("");
		setCompType("");
		setMultipleVersions(true);
	    }

	}

    }, [props.initial])

    useEffect(() => {

	let newFormValues = formValues;
	newFormValues["supplier"] = supplier;
	if (compType) {
	    /* just leave it out if not set - there's already a default value */
	    newFormValues["component_type"] = compType;
	}
	newFormValues["source"] = source;
	newFormValues["comment"] = comment;
	if (versions != [""]) {
	    newFormValues["versions"] = versions;
	}
	if (owner && owner.length > 0) {
	    newFormValues["owner"] = owner[0].uuid;
	} else {
	    newFormValues["owner"] = "";
	}
	if (externalids.length > 0) {
	    const exids = []
	    externalids.forEach((item) => {
		if (item.id != "") {
		    let x = {}
		    x[item.id_type] = item.id;
		    exids.push(x);
		}
	    });
	    newFormValues["external_ids"] = exids;
	} else {
	    newFormValues["external_ids"] = [];
	}

	newFormValues["checksum"] = checksum;
	newFormValues["homepage"] = homepage;
	newFormValues['tags'] = tags.map((item) => {
            if (item.tag) {
                return item.tag;
            }else {
		return item;
            }
        });
	setFormValues(newFormValues);
	props.update(newFormValues);

    }, [supplier, compType, source, comment, owner, versions, checksum, homepage, externalids, tags])


    return (
	<Row>
	    <Col lg={6} md={6} sm={12}>
	    <Form.Group className="mb-3" controlId="_type">
		<Form.Label>Component Name<span className="required">*</span></Form.Label>

		<ComponentTypeahead
		    component = {name}
		    setComponent = {setName}
		    disabled = {false}
		    allowNew={true}
		/>
	    </Form.Group>
	    <Form.Group className="mb-3">
		<Form.Label>Owner<span className="required">*</span></Form.Label>
		<GroupTypeahead
		    owner = {owner}
		    setOwner ={setOwner}
		    invalid={invalidOwner}
		    disabled={props.group ? true : false}
		    options={groupOptions}
		/>
	    </Form.Group>

	    <Form.Group className="mb-3" controlId="_type">
		<Form.Label>Versions</Form.Label>
		{versions.map((element, index) => (
		<div className="form-inline d-flex align-items-center gap-3 mb-2" key={index}>
		    <Form.Control type="text" name="version" value={element || ""} onChange={e => handleChange(index, e)} />
			{
			    index ?
				<Button variant="btn-icon px-1" type="button" onClick={() => removeFormFields(index, "version")}><i className="fas fa-trash"></i></Button>
			    : null
			}
		    </div>
		))}
		{multipleVersions &&
		 <Button size="sm" variant="outline-primary" type="button" onClick={() => addFormFields("version")}><i className="fas fa-plus"></i>{" "}Add Version</Button>
		}
	    </Form.Group>

		<Form.Group className="mb-3" controlId="_type">
                    <Form.Label>External IDs</Form.Label>
		    {externalids.map((element, index) => (
			<Row className="mb-2" key={`extid-${index}`}>
			    <Col lg={3} sm={5}>
				<Form.Label>ID Type</Form.Label>
				<Form.Select name="id_type" value={element.id_type} onChange={(e)=>handleChange(index, e)} aria-label="External ID Type Select">
				    {EXTERNAL_ID_TYPES.map((choice) => (
					<option key={choice} value={choice}>{choice} </option>
				    ))}
				</Form.Select>
			    </Col>
			    <Col lg={8} sm={6}>
				<Form.Label>External ID</Form.Label>
				<Form.Control type="text" name="id" value={element.id || ""} onChange={e => handleChange(index, e)} />
			    </Col>

			    <Col lg={1}>
				<Form.Label>{" "}</Form.Label>
				<Button variant="btn-icon px-1" type="button" onClick={() => removeFormFields(index, "external")}><i className="fas fa-trash"></i></Button>
			    </Col>
			</Row>
			))}
                    <Button size="sm" variant="outline-primary" type="button" onClick={() => addFormFields("external")}><i className="fas fa-plus"></i>{" "}Add ID</Button>

            </Form.Group>
		{user && containsAny(user.roles, ['coordinator', 'coordinator_mgr']) &&
		<Form.Group className="mb-3" controlId="_type">
                    <Form.Label>Tags</Form.Label>
		    <TagTypeahead
                        dataType= {"component"}
                        setTags = {setTags}
                        tags = {tags}
                        disabled = {false}
                    />            
		</Form.Group>
		}
		    

	    </Col>
	    <Col lg={6} md={6} sm={12}>
	    <Form.Group className="mb-3">
		<Form.Label>Component Type</Form.Label>
		<Form.Select name="component_type" value={compType} onChange={(e)=>setCompType(e.target.value)} aria-label="Component Type Select">
                    {componentTypeOptions.map((choice) => (
                        <option key={choice.value} value={choice.value}>{choice.display_name} </option>
                    ))}
                </Form.Select>
	    </Form.Group>

	    <Form.Group className="mb-3">
                <Form.Label>Supplier</Form.Label>

		<Form.Control type="text" name="supplier" value={supplier} onChange={e => setSupplier(e.target.value)} />
            </Form.Group>
	    <Form.Group className="mb-3">
                <Form.Label>Source</Form.Label>
		<Form.Control type="text" name="source" value={source} onChange={e => setSource(e.target.value)}/>

            </Form.Group>
	    <Form.Group className="mb-3">
		<Form.Label>Homepage</Form.Label>
		<Form.Control type="text" name="source" value={homepage} onChange={e => setHomepage(e.target.value)}/>
            </Form.Group>
	    <Form.Group className="mb-3">
                <Form.Label>Checksum</Form.Label>
                <Form.Control type="text" name="source" value={checksum} onChange={e => setChecksum(e.target.value)}/>
            </Form.Group>

	    <Form.Group className="mb-3">
		<Form.Label>Comment</Form.Label>
		<Form.Control as="textarea" rows={3} name="comment" value={comment} onChange={e => setComment(e.target.value)} />
            </Form.Group>
	    </Col>
	</Row>
    )

};

export default ComponentForm;
