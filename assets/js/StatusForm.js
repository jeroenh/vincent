import React from "react";
import {
    OverlayTrigger,
    Popover,
    Tooltip,
    ToggleButton,
    Modal,
    Row,
    Col,
    Alert,
    ButtonGroup,
    Badge,
    Button,
    Form,
    Tab,
} from "react-bootstrap";
import { useState, useEffect } from "react";
import ComponentAPI from "./ComponentAPI.js";
import {
    format,
    formatDistance,
    addMinutes,
    parse,
    isValid,
    addDays,
} from "date-fns";
import ComponentTypeahead from "./ComponentTypeahead";
import GroupTypeahead from "./GroupTypeahead";
import { Typeahead } from "react-bootstrap-typeahead";
import { Calendar } from "react-date-range";
import "react-date-range/dist/styles.css"; // main style file
import "react-date-range/dist/theme/default.css"; // theme css file

const VERSION_RANGE_CHOICES = [
    { val: null, desc: "" },
    { val: "<", desc: "< (less than)" },
    { val: "<=", desc: "<= (less than or Equal)" },
];

const VERSION_TYPE_CHOICES = [
    { val: null, desc: "" },
    { val: "custom", desc: "custom" },
    { val: "git", desc: "git" },
    { val: "maven", desc: "maven" },
    { val: "python", desc: "python" },
    { val: "rpm", desc: "rpm" },
    { val: "semver", desc: "semver" },
];

const CVE_STATUS_CHOICES = [
    { val: 0, desc: "Unknown" },
    { val: 1, desc: "Affected" },
    { val: 2, desc: "Unaffected" },
];

const STATUS_CHOICES = [
    { val: 0, desc: "Not Affected" },
    { val: 1, desc: "Affected" },
    { val: 2, desc: "Fixed" },
    { val: 3, desc: "Under Investigation" },
    { val: 4, desc: "Unknown" },
];

const RELATIONSHIP_CHOICES = [
    { val: null, desc: "" },
    { val: "default_component_of", desc: "default component of" },
    { val: "external_component_of", desc: "external component of" },
    { val: "installed_on", desc: "installed on" },
    { val: "installed_with", desc: "installed with" },
    { val: "optional_component_of", desc: "optional component ofd" },
];

const JUSTIFICATION_CHOICES = [
    { val: "component_not_present", desc: "Component not present" },
    { val: "vulnerable_code_not_present", desc: "Vulnerable code not present" },
    {
        val: "vulnerable_code_not_in_execute_path",
        desc: "Vulnerable code not in execute path",
    },
    {
        val: "vulnerable_code_cannot_be_controlled_by_adversary",
        desc: "Vulnerable code cannot be controlled by adversary",
    },
    {
        val: "inline_mitigations_already_exist",
        desc: "Inline mitigations already exist",
    },
];

const REMEDIATION_CATEGORIES = [
    { val: null, desc: "" },
    { val: "mitigation", desc: "Mitigation" },
    { val: "no_fix_planned", desc: "No Fix Planned" },
    { val: "none_available", desc: "None Available" },
    { val: "vendor_fix", desc: "Vendor Fix" },
    { val: "workaround", desc: "Workaround" },
];

const componentapi = new ComponentAPI();

const StatusForm = (props) => {
    const [isLoading, setIsLoading] = useState(true);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [selComponent, setSelComponent] = useState([]);
    const [invalidComponent, setInvalidComponent] = useState(false);
    const [invalidOtherComponent, setInvalidOtherComponent] = useState(false);
    const [version, setVersion] = useState("");
    const [compRelationship, setCompRelationship] = useState("");
    const [otherComponent, setOtherComponent] = useState([]);
    const [otherSupplier, setOtherSupplier] = useState([]);
    const [otherComponentVersion, setOtherComponentVersion] = useState("");
    const [ocSupplierDisabled, setOCSupplierDisabled] = useState(false);
    const [invalidOtherSupplier, setInvalidOtherSupplier] = useState(false);
    const [invalidOwner, setInvalidOwner] = useState(false);
    const [invalidVuls, setInvalidVuls] = useState(false);
    const [statusDisabled, setStatusDisabled] = useState(false);
    const [supplierDisabled, setSupplierDisabled] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [owner, setOwner] = useState([]);
    const [invalidVersion, setInvalidVersion] = useState([
        { field: "", msg: "" },
    ]);
    const [invalidRemediation, setInvalidRemediation] = useState(null);
    const [invalidDate, setInvalidDate] = useState(null);
    const [vulStatement, setVulStatement] = useState("");
    const [shareStatus, setShareStatus] = useState(false);
    const [defaultStatus, setDefaultStatus] = useState("Unknown");
    const [statusWarning, setStatusWarning] = useState([]);
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [editVuls, setEditVuls] = useState([]);
    const [showCalendar, setShowCalendar] = useState(false);
    const [selectedVuls, setSelectedVuls] = useState([]);
    const [statusFields, setStatusFields] = useState([
        {
            status: "",
            version_value: [],
            version_range: "",
            justification: "",
            version_end_range: "",
            version_type: "",
            remediation_category: "",
            remediation_detail: "",
            remediation_date: "",
            remediation_url: "",
        },
    ]);
    const radios = [
        { name: "Share", value: true },
        { name: "Don't Share", value: false },
    ];

    const handleVulSelect = (e) => {
        // Destructuring
        const { value, checked } = e.target;

        // Case 1 : The user checks the box
        if (checked) {
            setSelectedVuls((selectedVuls) => [...selectedVuls, value]);
        }
        // Case 2  : The user unchecks the box
        else {
            setSelectedVuls((vul) => vul.filter((select) => select != value));
        }
    };

    useEffect(() => {
        if (props.editStatus) {
            if (props.editStatus.component) {
                setSelComponent([
                    {
                        name: props.editStatus.component.name,
                        id: props.editStatus.component.id,
                    },
                ]);
                /*setVersion(props.editStatus.version);*/
                if (props.editStatus.component.owner) {
                    setOwner([props.editStatus.component.owner]);
                } else {
                    setOwner([]);
                }
            }

            if (props.editStatus.other_component) {
                setShowAdvanced(true);
                setOtherComponent([
                    {
                        name: props.editStatus.other_component.name,
                        id: props.editStatus.other_component.id,
                    },
                ]);
                /*setVersion(props.editStatus.version);*/
                if (props.editStatus.other_component.owner) {
                    setOtherSupplier([props.editStatus.other_component.owner]);
                } else {
                    setOtherSupplier([]);
                }
                setCompRelationship(props.editStatus.relationship);
                setOtherComponentVersion(props.editStatus.other_component_version);
            }

            if (props.clone) {
                setStatusDisabled(false);
		setOCSupplierDisabled(false);
		setSupplierDisabled(false);
            } else {
                setStatusDisabled(true);
		setSupplierDisabled(true);
		// set this to disabled because unless user chooses a new other_component,
		// any changes to other component supplier will go unnoticed
		setOCSupplierDisabled(true); 
		
            }

            let selstatus = props.editStatus.vuls.filter(
                (item) => item.id == props.editVul
            );
            setEditVuls([selstatus[0].vul]);
            setStatusFields(JSON.parse(JSON.stringify(selstatus[0].status)));
            setSelectedVuls([selstatus[0].vul.id.toString()]);
            setVulStatement(selstatus[0].statement || "");
            setShareStatus(selstatus[0].share);
            setDefaultStatus(selstatus[0].default_status);
            let iv = [];
            selstatus[0].status.map((s, index) => {
                iv.push({ field: "", msg: "" });
            });
            setInvalidVersion(iv);
        } else {
            /* clear out field values */
            setSelComponent([]);
            setOtherComponent([]);

            setVulStatement("");
            setSelectedVuls([]);
            setStatusDisabled(false);
	    setSupplierDisabled(false);
	    setOCSupplierDisabled(false);
            setCompRelationship("");
            setOtherComponentVersion("");
            setDefaultStatus("Unknown");
            setInvalidVersion([{ field: "", msg: "" }]);
            setShareStatus(false);
            setStatusFields([
                {
                    status: "",
                    version_value: [],
                    version_range: "",
                    justification: "",
                    version_end_range: "",
                    version_type: "",
                    remediation_category: "",
                    remediation_detail: "",
                    remediation_date: "",
                    remediation_url: "",
                },
            ]);
            if (
                props.user?.groups?.length == 1 &&
                !(props.user?.role == "owner")
            ) {
                /* if this is a supplier and only belongs to 1 group, prepopulate the owner */
                setOwner([props.user.groups[0]]);
                setOtherSupplier([props.user.groups[0]]);
            } else {
                setOwner([]);
                setOtherSupplier([]);
            }
        }
    }, [props.editStatus]);

    const VulLabel = (props) => {
        return (
            <OverlayTrigger
                overlay={
                    <Tooltip>
                        {props.vul.vul}: {props.vul.description}
                    </Tooltip>
                }
            >
                <div className="d-flex align-items-center gap-2">
                    {props.vul.vul}{" "}
                    {props.vul.title && <span>{props.vul.title}</span>}{" "}
                    <i className="fas fa-info-circle"></i>
                </div>
            </OverlayTrigger>
        );
    };

    const StatusWarning = (props) => {
        let msg = "";

        if (props.status) {
            switch (props.status) {
                case "Not Affected":
                    break;
                case "Fixed":
                    msg = 'CVE will publish this status as "Not Affected"';
                    break;
                case "Under Investigation":
                    msg = 'CVE will publish this status as "Unknown"';
                    break;
                case "Unknown":
                    msg =
                        'Any VEX statements produced will use "Under Investigation"';
                    break;
                default:
                    break;
            }
        }

        return msg ? <Alert variant="warning">{msg}</Alert> : "";
    };

    const setSelectedComponent = (e) => {
        setSelComponent(e);

        if (e && e[0]?.owner_name) {
            setOwner([e[0].owner_name]);
	    setSupplierDisabled(true);
        } else {
	    setSupplierDisabled(false);
	}
        props.changes(true);
    };

    const setOtherSelectedComponent = (e) => {
        setOtherComponent(e);

        if (e && e[0]?.owner_name) {
            setOtherSupplier([e[0].owner_name]);
	    setOCSupplierDisabled(true);
        } else {
	    setOCSupplierDisabled(false);
	}
        props.changes(true);
    };

    const validateRemediation = (index) => {
        let msg = "";
        const element = statusFields[index];

        if (element.remediation_date) {
            /* check format */
            const dateFormat = "yyyy-MM-dd";
            const parsedDate = parse(
                element.remediation_date,
                dateFormat,
                new Date()
            );
            if (!isValid(parsedDate)) {
                setInvalidDate({
                    index: index,
                    msg: "Invalid Date Format. Should be YYYY-MM-DD",
                });
            } else {
                setInvalidDate(null);
            }
        }
        if (element.remediation_category && !element.remediation_detail) {
            setInvalidRemediation({
                index: index,
                msg: "Details required to populate CSAF remediations",
            });
        } else if (element.remediation_url && !element.remediation_detail) {
            setInvalidRemediation({
                index: index,
                msg: "Details required to populate CSAF remediations",
            });
        } else {
            setInvalidRemediation(null);
        }
    };

    const validateVersion = (index) => {
        let msg = "";
        const element = statusFields[index];
        const errors = invalidVersion;

        /* insert complicated version validation */
        if (element.version_value.length == 0) {
            msg = "Version is required";
            errors[index].field = "version_value";
        } else if (element.version_range && !element.version_end_range) {
            msg = "End version is required when selecting range";
            errors[index].field = "version_end_range";
        } else if (element.version_end_range && !element.version_range) {
            msg = "Version range is required when providing End Range";
            errors[index].field = "version_affected";
        } else if (element.version_range && !element.version_type) {
            msg = "Version type is required when selecting range";
            errors[index].field = "version_type";
        } else if (element.version_value[0] == element.version_end_range) {
            msg = "End is the same as the start";
            errors[index].field = "version_end_range";
        } else if (element.version_type && !element.version_range) {
            msg =
                "Version type is only used for ranges. Clear this or define a range";
            errors[index].field = "version_type";
        } else {
            errors[index].field = "";
            errors[index].msg = "";
            setInvalidVersion(errors);
        }
        if (msg) {
            errors[index].msg = msg;
            setInvalidVersion(errors);
        }
    };

    const submitStatus = (event) => {
        let error = false;
        const formDataObj = {};
        setErrorMessage(null);

        event.preventDefault();

        statusFields.forEach((item, index) => validateVersion(index));

        if (invalidDate) {
            return;
        }

        setFormSubmitting(true);
        if (selComponent.length == 0) {
            setInvalidComponent(true);
            error = true;
        } else {
            if ("customOption" in selComponent[0]) {
                formDataObj["component"] = {
                    name: selComponent[0].name,
                    owner: owner[0]?.uuid,
                };
            } else if (selComponent[0].id) {
                formDataObj["component"] = { id: selComponent[0].id, owner: owner[0]?.uuid };
            } else {
                formDataObj["component"] = {
                    name: selComponent[0].name,
                    owner: owner[0]?.uuid,
                };
            }
            setInvalidComponent(false);
        }

        if (
            compRelationship ||
            otherComponent.length > 0 ||
            otherSupplier.length > 0
        ) {
            /* if any of these fields are populated, make sure they are all populated! */
            if (otherComponent.length == 0) {
                setInvalidOtherComponent(true);
                setErrorMessage(
                    "Form errors found. Please provide other component or remove all advanced configuration fields."
                );
                setFormSubmitting(false);
                return;
            }
            if (otherSupplier.length == 0) {
                setInvalidOtherSupplier(true);
                setErrorMessage(
                    "Form errors found. Please provide other component supplier or remove all advanced configuration fields."
                );
                setFormSubmitting(false);
                return;
            }
            if (compRelationship == "") {
                setErrorMessage(
                    "Form errors found. Please provide relationship between components or remove all advanced configuration fields."
                );
                setFormSubmitting(false);
                return;
            }

            if ("customOption" in otherComponent[0]) {
                formDataObj["other_component"] = {
                    name: otherComponent[0].name,
                    owner: otherSupplier[0]?.uuid,
                };
            } else if (otherComponent[0].id) {
                formDataObj["other_component"] = { id: otherComponent[0].id, owner: otherSupplier[0]?.uuid };
            } else {
                formDataObj["other_component"] = {
                    name: otherComponent[0].name,
                    owner: otherSupplier[0]?.uuid,
                };
            }
            setInvalidOtherComponent(false);
            setInvalidOtherSupplier(false);
            formDataObj["relationship"] = compRelationship;
            formDataObj["other_component_version"] = otherComponentVersion;
        }

        if (selectedVuls.length == 0) {
            setInvalidVuls(true);
            error = true;
        } else {
            setInvalidVuls(false);
        }

        /* check for invalid version ranges  */
        const versions_invalid = invalidVersion.filter(
            (item) => item.field != ""
        );

        if (versions_invalid.length > 0) {
            error = true;
        } else {
            const errors = invalidVersion;
            const invalid_status = statusFields.filter((item, index) => {
                if (item.status == "" || item.version_value == "") {
                    errors[index].field = "status";
                    errors[index].msg = "Status is required";
                    return item;
                } else if (
                    item.status == "Not Affected" &&
                    item.justification == ""
                ) {
                    errors[index].field = "justification";
                    return item;
                }
            });

            if (invalid_status.length > 0) {
                error = true;
                setInvalidVersion(errors);
            }
        }

        if (error == false) {
            let updatedStatus = JSON.parse(JSON.stringify(statusFields));
            updatedStatus.map((item) => {
                if (Array.isArray(item.version_value)) {
                    item["version_value"] = item.version_value[0].version;
                }
            });

            formDataObj["status"] = updatedStatus;
            formDataObj["share"] = shareStatus;
            formDataObj["statement"] = vulStatement;
            formDataObj["default_status"] = defaultStatus;
            formDataObj["vuls"] = selectedVuls;
            props.submit(formDataObj);
            setFormSubmitting(false);
        } else {
            setErrorMessage("Form errors found.");
            setFormSubmitting(false);
        }
    };

    const handleDateChange = (i, date) => {
        let newFormValues = [...statusFields];
        if (date) {
            let d = new Date(date);
            newFormValues[i]["remediation_date"] = format(
                addMinutes(date, date.getTimezoneOffset()),
                "yyyy-MM-dd"
            );
            //newFormValues[i]["remediation_date"] = format(date, 'yyyy-MM-dd');
        } else {
            newFormValues[i]["remediation_date"] = "";
        }
        setStatusFields(newFormValues);
        props.changes(true);
    };

    const handleChange = (i, e) => {
        let formname = e.target.name;
        if (e.target.name.startsWith("status")) {
            formname = "status";
        }

        let newFormValues = [...statusFields];
        newFormValues[i][formname] = e.target.value;
        setStatusFields(newFormValues);

        if (
            [
                "version_type",
                "version_end_range",
                "version_range",
                "version_value",
                "status",
            ].includes(e.target.name)
        ) {
            validateVersion(i);
        }

        if (e.target.name.startsWith("remediation")) {
            validateRemediation(i);
        }

        props.changes(true);
    };

    const handleTypeaheadChange = (i, name, e) => {
        let newFormValues = [...statusFields];
        newFormValues[i][name] = e;
        setStatusFields(newFormValues);
        props.changes(true);
    };

    const onBlurFn = (i, name, e) => {
        handleTypeaheadChange(i, name, [{ version: e.target.value }]);
        props.changes(true);
    };

    const addVersions = () => {
        setStatusFields([
            ...statusFields,
            {
                status: "",
                version_value: [],
                version_range: "",
                justification: "",
                version_end_range: "",
                version_type: "",
                remediation_category: "",
                remediation_detail: "",
                remediation_date: "",
                remediation_url: "",
            },
        ]);
        setInvalidVersion([...invalidVersion, { field: "", msg: "" }]);
    };

    const cloneVersions = (i) => {
        /* do a deep clone */
        let clonedVersion = JSON.parse(JSON.stringify(statusFields[i]));

        setStatusFields([...statusFields, clonedVersion]);
        setInvalidVersion([...invalidVersion, { field: "", msg: "" }]);
    };

    const removeVersions = (i) => {
        let newFormValues = [...statusFields];
        newFormValues.splice(i, 1);
        setStatusFields(newFormValues);

        let newError = [...invalidVersion];
        newError.splice(i, 1);
        setInvalidVersion(newError);
        props.changes(true);
    };

    return (
        <Form onSubmit={(e) => submitStatus(e)} id="statusform">
            <Row>
                <Col lg={showAdvanced ? `4` : `12`}>
                    <Form.Group className="mb-3" controlId="componentNameInput">
                        <div className="d-flex justify-content-between">
                            <Form.Label>
                                Component<span className="required">*</span>
                            </Form.Label>
                            {showAdvanced ? (
                                ""
                            ) : (
                                <a
                                    href="#"
                                    onClick={(e) => (
                                        setShowAdvanced(true),
                                        e.preventDefault()
                                    )}
                                >
                                    Advanced
                                </a>
                            )}
                        </div>
                        <ComponentTypeahead
                            component={selComponent}
                            setComponent={setSelectedComponent}
                            disabled={statusDisabled}
                            allowNew={true}
                            invalid={invalidComponent}
                            querystr="&my=1"
                        />
                        {props.editStatus && (
                            <Form.Text>
                                To change the component, remove this component
                                status and add a new one.
                            </Form.Text>
                        )}
                        {invalidComponent && (
                            <Form.Text className="error">
                                This field is required.
                            </Form.Text>
                        )}
                    </Form.Group>
                </Col>
                {showAdvanced && (
                    <>
                        <Col lg={4}>
                            <Form.Group
                                className="mb-3"
                                controlId="componentRelationship"
                            >
                                <Form.Label>Relationship</Form.Label>
                                <Form.Select
                                    name="relationship"
                                    value={compRelationship}
                                    onChange={(e) =>
                                        setCompRelationship(e.target.value)
                                    }
                                    aria-label="Relationship Type Select"
                                >
                                    {RELATIONSHIP_CHOICES.map((choice) => (
                                        <option
                                            key={choice.val}
                                            value={choice.val}
                                        >
                                            {choice.desc}{" "}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col lg={4}>
                            <Form.Group
                                className="mb-3"
                                controlId="otherComponent"
                            >
                                <Form.Label>Other Component</Form.Label>
                                <ComponentTypeahead
                                    component={otherComponent}
                                    setComponent={setOtherSelectedComponent}
                                    allowNew={true}
                                    invalid={invalidOtherComponent}
                                    querystr="&my=1"
                                />
                                {invalidOtherComponent && (
                                    <Form.Text className="error">
                                        This field is required.
                                    </Form.Text>
                                )}
                            </Form.Group>
                        </Col>
                    </>
                )}
                <Col lg={showAdvanced ? `4` : `12`}>
                    <Form.Group className="mb-3" controlId="supplierInput">
                        <Form.Label>
                            Supplier<span className="required">*</span>
                        </Form.Label>
                        <GroupTypeahead
                            owner={owner}
                            setOwner={setOwner}
                            invalid={invalidOwner}
                            disabled={statusDisabled || supplierDisabled}
                            options={
                                props.user.role === "owner"
                                    ? null
                                    : props.user.groups
                            }
                        />
                        {invalidOwner && (
                            <Form.Text className="error">
                                Component Supplier is required.
                            </Form.Text>
                        )}
                    </Form.Group>
                </Col>
                {showAdvanced && (
                    <>
                        <Col lg={4}></Col>
                        <Col lg={4}>
                            <Form.Group
                                className="mb-3"
                                controlId="otherSupplierInput"
                            >
                                <Form.Label>
                                    Other Component Supplier
                                </Form.Label>
                                <GroupTypeahead
                                    owner={otherSupplier}
                                    setOwner={setOtherSupplier}
				    disabled={ocSupplierDisabled}
                                    invalid={invalidOtherSupplier}
                                    options={
                                        props.user.role === "owner"
                                            ? null
                                            : props.user.groups
                                    }
                                />
                                {invalidOtherSupplier && (
                                    <Form.Text className="error">
                                        Componet Supplier is required.
                                    </Form.Text>
                                )}
                            </Form.Group>
                        </Col>
                        <Col lg={8}></Col>
                        <Col lg={4}>
                            <Form.Group
                                className="mb-3"
                                controlId="otherComponentVersion"
                            >
                                <Form.Label>Other Component Version</Form.Label>
                                <Form.Control
                                    name="other_component_version"
                                    placeholder="Optional version for other component"
                                    value={otherComponentVersion}
                                    onChange={(e)=>setOtherComponentVersion(e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                    </>
                )}
            </Row>

            <Form.Group className="mb-3" controlId="affectedVuls">
                <Form.Label>Select Affected Vuls</Form.Label>
                {props.vuls.map((vul, index) => (
                    <Form.Check
                        key={`vul-${vul.id}`}
                        label={<VulLabel vul={vul} />}
                        name="vuls"
                        id={`affectedVuls-${vul.vul}`}
                        aria-label={vul.vul}
                        value={vul.id}
                        checked={
                            selectedVuls.includes(vul.id.toString())
                                ? true
                                : false
                        }
                        type="checkbox"
                        onChange={handleVulSelect}
                    />
                ))}
                {props.vuls.length == 0 && (
                    <>
                        {editVuls.map((vul, index) => (
                            <Form.Check
                                key={`vul-${vul.id}`}
                                label={<VulLabel vul={vul} />}
                                name="vuls"
                                aria-label={vul.vul}
                                value={vul.id}
                                checked={true}
                                type="checkbox"
                                onChange={handleVulSelect}
                            />
                        ))}
                    </>
                )}

                {invalidVuls && (
                    <Form.Text className="error">
                        This field is required.
                    </Form.Text>
                )}
            </Form.Group>

            <Form.Group className="mb-3" controlId="defaultStatus">
                <Form.Label>
                    Default Status{" "}
                    <OverlayTrigger
                        overlay={
                            <Tooltip>
                                Versions not matched by any version object take
                                the status listed in defaultStatus. When
                                defaultStatus is itself omitted, it defaults to
                                unknown.
                            </Tooltip>
                        }
                    >
                        <i className="fas fa-question-circle"></i>
                    </OverlayTrigger>
                </Form.Label>{" "}
                <br />
                <div onChange={(e) => setDefaultStatus(e.target.value)}>
                    {CVE_STATUS_CHOICES.map((type) => (
                        <Form.Check
                            inline
                            id={`defaultStatus-${type.desc}`}
                            label={type.desc}
                            aria-label={type.desc}
                            key={`defaultstatus-${type.desc}`}
                            name="default_status"
                            checked={defaultStatus === type.desc ? true : false}
                            value={type.desc}
                            onChange={setDefaultStatus}
                            type="radio"
                        />
                    ))}
                </div>
            </Form.Group>

            {statusFields.map((element, index) => (
                <div
                    key={`statusfields-${index}`}
                    className="border-top border-bottom py-2 mb-2"
                >
                    <Row className="mb-3">
                        <Col lg={3} md={6} sm={12}>
                            <Form.Group controlId="versionInput">
                                <Form.Label>
                                    Version (or start range){" "}
                                    <span className="required">*</span>
                                </Form.Label>

                                {selComponent.length > 0 ? (
                                    <Typeahead
                                        id="versions"
                                        options={
                                            selComponent[0].versions?.length > 0
                                                ? selComponent[0].versions
                                                : []
                                        }
                                        allowNew
                                        labelKey="version"
                                        onBlur={(e) =>
                                            onBlurFn(index, "version_value", e)
                                        }
                                        onChange={(e) =>
                                            handleTypeaheadChange(
                                                index,
                                                "version_value",
                                                e
                                            )
                                        }
                                        className="typeahead"
                                        isInvalid={
                                            invalidVersion[index].field ==
                                            "version_value"
                                        }
                                        selected={
                                            Array.isArray(element.version_value)
                                                ? element.version_value
                                                : [element.version_value]
                                        }
                                        placeholder="Select version"
                                        renderMenuItemChildren={(option) => (
                                            <span>{option.version}</span>
                                        )}
                                    />
                                ) : (
                                    <Form.Control
                                        name="version_value"
                                        isInvalid={
                                            invalidVersion[index].field ==
                                            "version_value"
                                        }
                                        value={element.version_value}
                                        onChange={(e) => handleChange(index, e)}
                                    />
                                )}
                                {invalidVersion[index].field ==
                                    "version_value" && (
                                    <Form.Text className="error">
                                        Version is required.
                                    </Form.Text>
                                )}
                            </Form.Group>
                        </Col>
                        <Col lg={3} md={6} sm={12}>
                            <Form.Group controlId="versionRange">
                                <Form.Label>Version Range</Form.Label>
                                <Form.Select
                                    isInvalid={
                                        invalidVersion[index].field ==
                                        "version_affected"
                                    }
                                    name="version_range"
                                    value={element.version_range}
                                    onChange={(e) => handleChange(index, e)}
                                    aria-label="Range Select"
                                >
                                    {VERSION_RANGE_CHOICES.map((choice) => (
                                        <option
                                            key={choice.val}
                                            aria-label={choice.desc}
                                            value={choice.val}
                                        >
                                            {choice.desc}{" "}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col lg={3} md={6} sm={12}>
                            <Form.Group controlId="endVersionRange">
                                <Form.Label>End Version Range</Form.Label>
                                <Form.Control
                                    isInvalid={
                                        invalidVersion[index].field ==
                                        "version_end_range"
                                    }
                                    name="version_end_range"
                                    value={element.version_end_range}
                                    onChange={(e) => handleChange(index, e)}
                                />
                            </Form.Group>
                        </Col>
                        <Col lg={2} md={6} sm={12}>
                            <Form.Group controlId="versionType">
                                <Form.Label>Version Type</Form.Label>
                                <Form.Select
                                    name="version_type"
                                    value={element.version_type}
                                    isInvalid={
                                        invalidVersion[index].field ==
                                        "version_type"
                                    }
                                    onChange={(e) => handleChange(index, e)}
                                    aria-label="Version Type Select"
                                >
                                    {VERSION_TYPE_CHOICES.map((choice) => (
                                        <option
                                            key={choice.val}
                                            value={choice.val}
                                        >
                                            {choice.desc}{" "}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col lg={1} md={6} sm={12}>
                            <Form.Label>Actions</Form.Label>
                            <div className="text-nowrap">
                                <Button
                                    variant="btn btn-icon px-1"
                                    onClick={() => cloneVersions(index)}
                                >
                                    <i
                                        className="fas fa-copy"
                                        title="Clone Version"
                                    ></i>
                                </Button>
                                {statusFields.length > 1 && (
                                    <Button
                                        variant="btn btn-icon px-1"
                                        onClick={() => removeVersions(index)}
                                    >
                                        <i
                                            className="fas fa-trash warningtext"
                                            title="Remove Version"
                                        ></i>
                                    </Button>
                                )}
                            </div>
                        </Col>
                    </Row>
                    {invalidVersion[index].msg && (
                        <Alert variant="danger">
                            {" "}
                            {invalidVersion[index].msg}
                        </Alert>
                    )}
                    <Form.Group className="mb-3" controlId="componentStatus">
                        <Form.Label>
                            Status <span className="required">*</span>
                        </Form.Label>
                        <br />
                        <div onChange={(e) => handleChange(index, e)}>
                            {STATUS_CHOICES.map((type) => (
                                <Form.Check
                                    inline
                                    label={type.desc}
                                    id={`componentStatus-${type.desc}`}
                                    isInvalid={
                                        invalidVersion[index].field == "status"
                                    }
                                    key={`status-${index}-${type.desc}`}
                                    name={`status-${index}`}
                                    aria-label={`Status is ${type.desc}`}
                                    checked={
                                        element.status === type.desc
                                            ? true
                                            : false
                                    }
                                    value={type.desc}
                                    onChange={(e) => handleChange(index, e)}
                                    type="radio"
                                />
                            ))}
                        </div>

                        {invalidVersion[index].field === "status" && (
                            <Form.Text className="error">
                                This field is required.
                            </Form.Text>
                        )}
                        <StatusWarning status={element.status} />
                    </Form.Group>

                    <div className="mb-3">
                        <Row>
                            <Col lg={3} md={6} sm={12}>
                                <Form.Group
                                    className="mb-3"
                                    controlId="remediationCategory"
                                >
                                    <Form.Label>
                                        Remediation Category
                                    </Form.Label>
                                    <Form.Select
                                        name="remediation_category"
                                        value={element.remediation_category}
                                        onChange={(e) => handleChange(index, e)}
                                        aria-label="Category Select"
                                    >
                                        {REMEDIATION_CATEGORIES.map(
                                            (choice) => (
                                                <option
                                                    key={choice.val}
                                                    value={choice.val}
                                                >
                                                    {choice.desc}{" "}
                                                </option>
                                            )
                                        )}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col lg={9} md={6} sm={12}>
                                <Form.Group controlId="remediationUrl">
                                    <Form.Label>
                                        URL (Link to Remediation Details)
                                    </Form.Label>
                                    <Form.Control
                                        name="remediation_url"
                                        value={element.remediation_url || ""}
                                        onChange={(e) => handleChange(index, e)}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    </div>
                    <Form.Group className="mb-3" controlId="remediationDetails">
                        <Form.Label>Remediation Details</Form.Label>
                        <Row>
                            <Col lg={12}>
                                <Form.Control
                                    name="remediation_detail"
                                    isInvalid={
                                        invalidRemediation?.index == index
                                    }
                                    as="textarea"
                                    rows={3}
                                    value={element.remediation_detail}
                                    onChange={(e) => handleChange(index, e)}
                                />
                                {invalidRemediation &&
                                    invalidRemediation.index == index && (
                                        <Form.Text className="error">
                                            {invalidRemediation.msg}
                                        </Form.Text>
                                    )}
                            </Col>
                        </Row>
                    </Form.Group>
                    <Form.Group
                        className="d-flex align-items-center gap-3 mb-3"
                        controlId="dateOfRemediation"
                    >
                        <Form.Label>Date of Remediation</Form.Label>
                        {/*<input type="date" className="form-control" name="remediation_date" value={element.remediation_date || "" } onChange={(e)=>handleChange(index, e)} />*/}
                        <Form.Control
                            type="text"
                            name="remediation_date"
                            placeholder="YYYY-MM-DD"
                            isInvalid={invalidDate?.index == index}
                            value={element.remediation_date || ""}
                            onChange={(e) => handleChange(index, e)}
                        />
                        <Button
                            variant="icon"
                            onClick={(e) => setShowCalendar(!showCalendar)}
                        >
                            <i
                                className="fas fa-calendar"
                                title="Choose date of remediation"
                            ></i>
                        </Button>
                        {showCalendar && (
                            <Calendar
                                onChange={(item) => (
                                    handleDateChange(index, item),
                                    setShowCalendar(false)
                                )}
                                date={
                                    element.remediation_date
                                        ? addDays(
                                              new Date(
                                                  element.remediation_date
                                              ),
                                              1
                                          )
                                        : new Date()
                                }
                            />
                        )}

                        {element.remediation_date && (
                            <Button
                                variant="icon"
                                onClick={(e) => handleDateChange(index, "")}
                            >
                                <i className="fas fa-trash warningtext"></i>
                            </Button>
                        )}
                    </Form.Group>
                    {invalidDate && invalidDate.index == index && (
                        <Form.Text className="error">
                            {invalidDate.msg}
                        </Form.Text>
                    )}
                    {element.status === "Not Affected" && (
                        <Form.Group className="mb-3" controlId="justification">
                            <Form.Label>Justification</Form.Label>
                            <br />
                            <Form.Text>
                                A "Not Affected" status requires a
                                justification.
                            </Form.Text>
                            <div onChange={(e) => handleChange(index, e)}>
                                {JUSTIFICATION_CHOICES.map((type) => (
                                    <Form.Check
                                        label={type.desc}
                                        key={`status-${type.desc}`}
                                        name="justification"
                                        checked={
                                            element.justification === type.desc
                                                ? true
                                                : false
                                        }
                                        value={type.desc}
                                        isInvalid={
                                            invalidVersion[index].field ==
                                            "justification"
                                        }
                                        onChange={(e) => handleChange(index, e)}
                                        type="radio"
                                    />
                                ))}
                            </div>
                            {invalidVersion[index].field == "justification" && (
                                <Form.Text className="error">
                                    This field is required when status is "Not
                                    Affected."
                                </Form.Text>
                            )}
                        </Form.Group>
                    )}
                </div>
            ))}
            <div className="button-section mb-2">
                <Button
                    size="sm"
                    variant="outline-primary"
                    type="button"
                    onClick={() => addVersions()}
                >
                    <i className="fas fa-plus" title="Add version"></i> Add
                    Version
                </Button>
            </div>

            <Form.Group className="mb-3" controlId="additionalStatement">
                <Form.Label>Optional Statement/Comment</Form.Label>
                <Form.Control
                    name="statement"
                    as="textarea"
                    rows={3}
                    value={vulStatement}
                    onChange={(e) => setVulStatement(e.target.value)}
                />
            </Form.Group>
            <Form.Group className="mb-3" controlId="shareOption">
                <Form.Label>
                    Share status with other case participants?
                </Form.Label>
                <br />
                <ButtonGroup>
                    {radios.map((radio, idx) => (
                        <ToggleButton
                            key={idx}
                            id={`radio-${idx}`}
                            type="radio"
                            variant={idx ? "outline-danger" : "outline-success"}
                            name="share"
                            value={radio.value}
                            checked={shareStatus === radio.value}
                            onChange={(e) =>
                                setShareStatus(e.currentTarget.value)
                            }
                        >
                            {radio.name}
                        </ToggleButton>
                    ))}
                </ButtonGroup>
            </Form.Group>

            {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

            <div className="text-end d-flex justify-content-end gap-2">
                <Button
                    type="Cancel"
                    title="Cancel submission"
                    data-testid="status-cancel"
                    variant="outline-secondary"
                    onClick={(e) => (e.preventDefault(), props.cancel())}
                >
                    Cancel
                </Button>
                <Button
                    variant="primary"
                    type="submit"
                    title="Submit Status"
                    disabled={formSubmitting}
                    data-testid="submit-status"
                >
                    Submit
                </Button>
            </div>
        </Form>
    );
};

export default StatusForm;
