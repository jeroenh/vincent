import {AsyncTypeahead, Typeahead} from 'react-bootstrap-typeahead';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import AdminAPI from './AdminAPI';
import {Button, Row, Col, Form, OverlayTrigger, Tooltip} from 'react-bootstrap';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import '../css/casethread.css';

const CACHE = {};

const PER_PAGE = 50;

const cpeRegexConst = /^cpe:2\.3:[aho\*\-](:(((\?*|\*?)([a-zA-Z0-9\-\._]|(\\[\\\*\?!"#$$%&'\(\)\+,\/:;<=>@\[\]\^`\{\|}~]))+(\?*|\*?))|[\*\-])){5}(:(([a-zA-Z]{2,3}(-([a-zA-Z]{2}|[0-9]{3}))?)|[\*\-]))(:(((\?*|\*?)([a-zA-Z0-9\-\._]|(\\[\\\*\?!"#$$%&'\(\)\+,\/:;<=>@\[\]\^`\{\|}~]))+(\?*|\*?))|[\*\-])){4}$/g;

const VERSION_RANGE_CHOICES = [
    {val:null, desc:''},
    {val: '<', desc: '< (less than)'},
    {val: '<=', desc: '<= (less than or Equal)'},
];

const VERSION_TYPE_CHOICES = [
    {val: null, desc: ''},
    {val: "custom", desc: "custom"},
    {val: "git", desc: "git"},
    {val: "maven", desc: "maven"},
    {val: "python", desc: "python"},
    {val: "rpm", desc: "rpm"},
    {val: "semver", desc: "semver"},
]

const CVE_STATUS_CHOICES = [
    {val: 0, desc: 'Unknown'},
    {val: 1, desc: 'Affected'},
    {val: 2, desc: 'Unaffected'},
]

const adminapi = new AdminAPI();

const ActiveIndexWatcher = ({ update }) => {
    useEffect(update);
    return null;
};

function makeAndHandleRequest(query, page = 1) {
    return adminapi.searchCPES(query).then((response) => {
	//console.log(response);
	const items = response;
	const total_count = response.length;
	const options = items.map((i) => ({
            vendor: i.vendor,
            product: i.product,
        }));
	//console.log(options);
	return {options, total_count};

    });
}

function makeAndHandleRequestFull(query, page=1) {
    return adminapi.getCPEs(query).then((response) => {
        //console.log(response);
        let items = response.results;
        let total_count = response.count;
        const options = items.map((i) => ({
            cpe: i.cpe,
	    title: i.title,
	    vendor: i.vendor,
	    product: i.product,
	    version: i.version,

        }));
        //console.log(options);
        return {options, total_count};
    });
}

const CPETypeahead = (props) => {

    /* typeahead vars */
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const [isVersionLoading, setIsVersionLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [options, setOptions] = useState([]);
    const [vendorOptions, setVendorOptions] = useState([]);
    const [productOptions, setProductOptions] = useState([]);
    const [versionOptions, setVersionOptions] = useState([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [multiple, setMultiple] = useState([]);
    const [vendor, setVendor] = useState([]);
    const [product, setProduct] = useState([]);
    const [version, setVersion] = useState([]);
    const [invalidVersion, setInvalidVersion] = useState([{'field': '', 'msg': ''}]);
    const [invalidCPE, setInvalidCPE] = useState(false);
    const [statusFields, setStatusFields] = useState([{status: '', version_value: '0', version_range: '',  version_end_range: '', version_type: ''}])
    const [defaultStatus, setDefaultStatus] = useState("Unknown");
    const [oldRec, setOldRec] = useState("");
    
    const handleVendorSearch = (q) => {
	//console.log(q);

	if (CACHE[q]) {
            setOptions(CACHE[q].options);
            return;
        }

        setIsSearchLoading(true);

	let query = `vendor=${q}`;
        makeAndHandleRequest(query).then((resp) => {
            CACHE[q] = { ...resp, page: 1 };
            //console.log("OPTIONS ARE>>>>>>>", resp.options);
            setIsSearchLoading(false);
            setOptions(resp.options);
        });
    }

    const handleProductSearch = (q, v=null) => {

	if (!v) {
	    v = vendor[0]?.vendor;
	}
	
        if (CACHE[q]) {
            setProductOptions(CACHE[q].options);
            return;
        }
	
	let sp = encodeURIComponent(q);

	let query = `product=${sp}`;
	if (q) {
	    query = `product=${sp}`;
	} else if (v) {
	    query = `vendor=${v}&product=all`;
	}
	if (q && vendor[0]?.vendor) {
	    query = `vendor=${v}&product=${sp}`;
	}

        setIsSearchLoading(true);

        makeAndHandleRequest(query).then((resp) => {
            CACHE[query] = { ...resp, page: 1 };
            //console.log("OPTIONS ARE>>>>>>>", resp.options);
            setIsSearchLoading(false);
            setProductOptions(resp.options);
        });
    }


    const addVersions = () => {
        setStatusFields([...statusFields, {'status': '', 'version_value': [], 'version_range': '', 'justification': '', 'version_end_range': '', 'version_type': ''}])
        setInvalidVersion([...invalidVersion, {'field': '', 'msg': ''}])
    }

    const removeVersions = (i) => {
        let newFormValues = [...statusFields];
        newFormValues.splice(i, 1);
        setStatusFields(newFormValues)

        let newError = [...invalidVersion];
        newError.splice(i, 1);
	setInvalidVersion(newError);

    }

    const handleVersionSearch = (vendor, product) => {

	let query = '';

	let sp = encodeURIComponent(product);

	if (product) {
            query = `page_size=150&product=${sp}`;
	}
	if (vendor) {
	    query = `page_size=150&vendor=${vendor}`;
	    if (product) {
		query = `${query}&product=${sp}`;
	    }

	}

        setIsVersionLoading(true);

        makeAndHandleRequestFull(query).then((resp) => {
            CACHE[query] = { ...resp, page: 1 };
            //console.log("OPTIONS ARE>>>>>>>", resp.options);
            setIsVersionLoading(false);
            setVersionOptions(resp.options);
        });

    }

    const handleCPESearch = (q) => {
        let query = `page_size=150&search=${q}`;

	if (vendor[0]?.vendor) {
	    let sv = encodeURIComponent(vendor[0].vendor)
	    query = `${query}&vendor=${sv}`;
	}
	if (product[0]?.product) {
	    let sp = encodeURIComponent(product[0].product)
	    query=`${query}&product=${sp}`;
	}

        setIsVersionLoading(true);

        makeAndHandleRequestFull(query).then((resp) => {
            CACHE[query] = { ...resp, page: 1 };
            //console.log("OPTIONS ARE>>>>>>>", resp.options);
            setIsVersionLoading(false);
            setVersionOptions(resp.options);
        });

    }

    
    useEffect(() => {
	if (version.length > 0) {
	    const data = {version_info: statusFields, default_status: defaultStatus, cpe: version[0].cpe, product: version[0].product, version: version[0].version, vendor: version[0].vendor, status: version[0].status, id: oldRec}
	    setVendor([{vendor: version[0].vendor, product: version[0].product}])
	    setProduct([{vendor: version[0].vendor, product: version[0].product}])
	    //validateVersion();
	    props.setCPE(props.index, data);
	    setInvalidCPE(false);
	} else if (vendor[0]?.vendor && product[0]?.vendor) {
		setInvalidCPE(true);
	} else if (multiple.length > 0) {
	    const data = {version_info: statusFields, default_status: defaultStatus, cpes: multiple, id: oldRec}
	    props.setCPE(props.index, data)
	}
	
    }, [statusFields, version, defaultStatus]);


    const changeProdVendor = (val, type) => {
	let p = product[0]?.product;
	let v = vendor[0]?.vendor;

	if (type === "product") {
	    setProduct(val);
	    p = val[0]?.product;
	} else {
	    setVendor(val);
	    v = val[0]?.vendor;
	}

	if (v && p) {
	    /* search versions */
	    handleVersionSearch(v, p);
	} else if (v) {
	    handleProductSearch(null, v);
	    handleVersionSearch(v, null);
	} else if (p) {
	    handleVersionSearch(null, p);
	}
    }
    
    const handleChange = (i, e) => {
	let name = e.target.name;

	if (e.target.name.startsWith("status")) {
	    /* radio buttons need their own name */
	    name="status";
	}
	
	const newFormField = [...statusFields];
        newFormField[i][name] = e.target.value.trim();
	if (["version_range", "version_end_range"].includes(name) && !newFormField[i]["version_type"]) {
	    /* autoset to custom */
	    newFormField[i]["version_type"] = "custom";
	}

	setStatusFields(newFormField);

	if (['version_type', 'version_end_range', 'version_range', 'version_value', 'status'].includes(name)) {
            validateVersion(i);
        }

    }

    const validateVersion = (index) => {

	if (statusFields.length > 0) {

	    const element = statusFields[index];
	    const errors = invalidVersion;
	    let msg = "";

	    if (!element) {
		return;
	    }

	    if (element?.version_value?.length == 0) {
		msg = 'Version is required';
		errors[index].field = 'version_value';
	    } else if (element?.version_value === "*" || element?.version_value === "-") {
		msg = "*/- are invalid versions. Use 0 < * to represent all versions";
		errors[index].field = "version_value";
	    } else if (element.version_range && !element.version_end_range) {
		msg = "End version is required when selecting range";
		errors[index].field = 'version_end_range'
            } else if (element.version_end_range && !element.version_range) {
		msg =  "Version range is required when providing End Range";
		errors[index].field = 'version_range'
            } else if (element.version_range && !element.version_type) {
		msg = "Version type is required when selecting range";
		errors[index].field = 'version_type'
            } else if (element.version_value == element.version_end_range) {
		msg = "End is the same as the start";
		errors[index].field = 'version_end_range'
            } else if (element.version_type && !element.version_range) {
		msg = "Version type is only used for ranges. Clear this or define a range";
		errors[index].field = 'version_type'
	    } else {
		errors[index].field = ''
		errors[index].msg = '';
		setInvalidVersion(errors);
		props.errors(null);
	    }

	    if (element?.status == "") {
		msg="Status is required";
		errors[index].field = 'status';
	    }

	    if (msg) {
		errors[index].msg = msg
		setInvalidVersion(errors);
		props.errors(errors);
            } 

		
	}

    }

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

        setIsSearchLoading(true);

	const page = cachedQuery.page + 1;

        makeAndHandleRequestFull(query, page).then((resp) => {
            const options = cachedQuery.options.concat(resp.options);
            CACHE[query] = { ...cachedQuery, options, page };

            setIsSearchLoading(false);
            setOptions(options);
        });
    };

    const onVendorKeyDown = useCallback(
        (e) => {
	    /*tab or enter */
            if ([13, 9].includes(e.keyCode) && activeIndex === -1) {
                setVendor([e.target.value])
            }
        },
        [activeIndex]
    );

    const onVendorBlurFn = (e) => {
	if (vendor.length == 0) {
	    setVendor([e.target.value])
	}
    }

    const onProdKeyDown = useCallback(
        (e) => {
            /*tab or enter */
            if ([13, 9].includes(e.keyCode) && activeIndex === -1) {
                setProduct([e.target.value])
            }
        },
        [activeIndex]
    );

    const onProdBlurFn = (e) => {
        if (product.length == 0) {
            setProduct([e.target.value])
        }
    }

    const setVersionValue = (e) => {
	if (e.length > 0) {
	    console.log(e);
	    const newFormField = [...statusFields];
	    if (e[0]?.version === "*" || e[0]?.version === "-") {
		newFormField[0]["version_value"] = "0";
	    } else {
		newFormField[0]["version_value"] = e[0]?.version;
	    }
            setStatusFields(newFormField);
	}
    }

    useEffect(() => {

	setIsLoading(true);
	if (props.cpe) {
	    //console.log(props.cpe);
	    if (props.cpe.id) {
		setOldRec(props.cpe.id);
	    } else {
		setOldRec("");
	    }
	    
	    if (props.cpe.cpes?.length > 0) {
		setMultiple(props.cpe.cpes)
		setVersion([])
		setVendor([])
		setProduct([])
		if (props.cpe.version_info) {
		    setDefaultStatus(props.cpe.default_status);
		    if (Array.isArray(props.cpe.version_info)) {
			setStatusFields(props.cpe.version_info)
			let iv = []
                        props.cpe.version_info.map((s, index) => {
                            iv.push({'field': '', 'msg': ''})
                        })
                        setInvalidVersion(iv);
	            } else {
                        setStatusFields([props.cpe.version_info]);
                        setInvalidVersion([{"field": '', 'msg': ''}]);
                    }
		} else {
		    let iv = []
		    let sf = []
		    props.cpe.cpes.forEach((c, index) => {
			/* get version for cpe */
			let matches = c.split(":");
			try {
			    if (matches[5] && matches[5] != '*' && matches[5] != "-") {
				iv.push({'field': '', 'msg': ''})
				sf.push({status: 'Affected', version_value: `${matches[5]}`, version_range: '',  version_end_range: '', version_type: ''})
			    }
			} catch(err) {
			    console.log(err);
			}
		    });
		    if (iv.length == 0) {
			setInvalidVersion([{"field": '', 'msg': ''}]);
			setStatusFields([{status: '', version_value: '0', version_range: '',  version_end_range: '', version_type: ''}]);
		    } else {
			setStatusFields(sf);
			setInvalidVersion(iv);
		    }
                    setDefaultStatus("Unknown");
		}
	    
	    } else if (props.cpe.cpe) {
		setMultiple([]);
		//setVendor([props.cpe.vendor])
		setVendor([{vendor: props.cpe.vendor, product: props.cpe.product}])
		setProduct([{vendor: props.cpe.vendor, product: props.cpe.product}])
		//setProduct([props.cpe.product])
		setVersion([{'cpe': props.cpe.cpe, 'version': props.cpe.version, 'vendor': props.cpe.vendor, 'product': props.cpe.product}])
		setDefaultStatus(props.cpe.default_status);
		if (props.cpe.version_info) {
		    if (Array.isArray(props.cpe.version_info)) {
			setStatusFields(props.cpe.version_info)
			let iv = []
			props.cpe.version_info.map((s, index) => {
			    iv.push({'field': '', 'msg': ''})
			})
			setInvalidVersion(iv);
			
		    } else {
			setStatusFields([props.cpe.version_info]);
			setInvalidVersion([{"field": '', 'msg': ''}]);
		    }
		} else {
		    if (props.cpe.version == "*" || props.cpe.version == "-") {
			setStatusFields([{status: '', version_value: "0", version_range: '',  version_end_range: '', version_type: ''}])
		    } else {
		    	setStatusFields([{status: '', version_value: props.cpe.version, version_range: '',  version_end_range: '', version_type: ''}])
		    }
		}
	    } else {
		setMultiple([]);
		setStatusFields([{status: '', version_value: '0', version_range: '',  version_end_range: '', version_type: ''}])
		setDefaultStatus("Unknown");
		setVendor([]);
		setProduct([]);
		setVersion([]);
	    }
	}

	setIsLoading(false);
	
    }, [props.index, props.refresh])


    const removeFromCPEList = (index) => {
	let cpes = [...multiple];
	cpes.splice(index, 1);
	setMultiple(cpes);
	const data = {version_info: statusFields, default_status: defaultStatus, cpes: cpes, id: oldRec}
        props.setCPE(props.index, data)
    }
	

    return (
	<>
	    {multiple.length > 0 ?
	     <>
		 {multiple.map((m, index) => (
		     <div key={`cpe-multiple-${index}`} className="d-flex align-items-center gap-3">
			 
			 <Button variant="btn-icon" onClick={(e)=>removeFromCPEList(index)}><i className="fas fa-minus-circle"></i></Button>
			 <div><b>{m}</b></div>
		     </div>
		 ))}
		 <div className="my-2">
		     <Button variant="outline-primary" size="xs" onClick={(e)=>props.select(props.index)}>Select Multiple</Button>
		 </div>
	     </>
	     :
	     <>
		 <Row className="mb-1">
		     <Col lg={6}>
			 <Form.Label>Vendor</Form.Label>
			 <AsyncTypeahead
			     name="vendor"
			     disabled={props.disabled}
			     id="cpe_vendor"
			     options={options}
			     className="typeahead"
      			     onKeyDown={onVendorKeyDown}
			     onBlur={onVendorBlurFn}
			     onSearch={handleVendorSearch}
			     paginate
			     isLoading={isSearchLoading}
			     labelKey="vendor"
			     onChange={(v) => changeProdVendor(v, "vendor")}
			     selected={vendor}
			     useCache={false}
			     placeholder="Start typing for vendors"
			 />
		     </Col>
		     <Col lg={6}>
			 <Form.Label>Product</Form.Label>
			 <AsyncTypeahead
			     name="product"
			     options={productOptions}
			       id="cpe_product"
			       className="typeahead"
			       onSearch={handleProductSearch}
			       isLoading={isSearchLoading}
			       labelKey="product"
			       onChange={(p) => changeProdVendor(p, "product")}
			       selected={product}
			       minLength={0}
			       onKeyDown={onProdKeyDown}
			       onBlur={onProdBlurFn}
			       useCache={false}
			       placeholder="Start typing for products"
			       renderMenuItemChildren={(option) => (
				   <div className="d-flex align-items-center gap-2" key={option.product}>
				       <span>{option.product}</span>
				   </div>
				   
			       )}
			   />
		       </Col>
		   </Row>
		   <Row className="my-3">
		       <Col lg={12}>
			   <div className="d-flex align-items-start gap-3"><Form.Label>Version/CPE</Form.Label><Button variant="outline-primary" size="xs" onClick={(e)=>props.select()}>Select Multiple</Button></div>
			   <AsyncTypeahead
			       name="version"
			       paginate={true}
			       className="typeahead"
			       options={versionOptions}
			       disabled={vendor.length==0 && product.length==0}
			       id="cpe_version"
			       isLoading={isVersionLoading}
			       onSearch={handleCPESearch}
			       labelKey="cpe"
			       filterBy={["version", "cpe"]}
			       minLength={0}
			       onChange={(e)=>(setVersion(e), setVersionValue(e))}
			       selected={version}
			       isInvalid={invalidCPE}
			       useCache={false}
			       placeholder="Start typing for versions"
			   />
			   {invalidCPE &&
			    <Form.Text className="error">
				This field is required.
			    </Form.Text>
			   }
		       </Col>
		   </Row>
	       </>
	      }
            <Row className="mb-1">
		<Col lg={12}>
		    <Form.Group className="mb-3" controlId="_type">
			<Form.Label>Default Status <OverlayTrigger overlay={<Tooltip>Versions not matched by any version object take the status listed in defaultStatus. When defaultStatus is itself omitted, it defaults to unknown.</Tooltip>}><i className="fas fa-question-circle"></i></OverlayTrigger></Form.Label> <br/>
			<div onChange={(e)=>setDefaultStatus(e.target.value)}>
			    {CVE_STATUS_CHOICES.map((type) => (
				<Form.Check
				    inline
				    label={type.desc}
				    aria-label={type.desc}
				    key={`default_status-${type.desc}`}
				    name={`default_status-${props.index}`}
				    checked = {defaultStatus === type.desc ? true : false }
				    value={type.desc}
				    onChange={setDefaultStatus}
				    type="radio"
				/>
			    ))}
			</div>
		    </Form.Group>
		</Col>
	    </Row>

            {statusFields.map((element, index) => (
		<div key={`statusfields-${index}`} className="border-top border-bottom py-2 mb-2">
		    <Row className="mb-1">
			<Col lg={10} sm={10}>
			    <Form.Label>Status <span className="required">*</span></Form.Label><br/>
			    <div onChange={(e)=>handleChange(index, e)}>
				{CVE_STATUS_CHOICES.map((type) => (
				    <Form.Check
					inline
					label={type.desc}
					isInvalid={invalidVersion[index]?.field == "status"}
					key={`status-${type.desc}`}
					name={`status-${props.index}-${index}`}
					checked = {element.status === type.desc ? true : false }
					value={type.desc}
					onChange={e=>handleChange(index, e)}
					type="radio"
				    />
				))}
			    </div>
			    {invalidVersion[index].field == "status" &&
			     <Form.Text className="error">
				 This field is required.
			     </Form.Text>
			    }
			</Col>
			<Col lg={2} sm={2}>
                            {
                                index ?
				    <><Form.Label>{" "}</Form.Label>
                                    <Button size="sm" variant="outline-primary" onClick={() => removeVersions(index)}>Remove version</Button></>
                                : null
                            }
                        </Col>
		    </Row>
		    <Row className="mb-1">
			<Col lg={4} md={6} sm={12}>
			    <Form.Label>Version (or start range)</Form.Label>
			    <Form.Control name="version_value" isInvalid={invalidVersion[index].field == "version_value"} value={element.version_value} onChange={(e)=>handleChange(index, e)}/>
			    {invalidVersion[index].field == "version_value" &&
			     <Form.Text className="error">
				 {invalidVersion[index].msg}
			     </Form.Text>
			    }
			</Col>
			<Col lg={3} md={6} sm={12}>
			    <Form.Label>Version Range</Form.Label>
			    <Form.Select isInvalid={invalidVersion[index].field == "version_range"} name="version_range" value={element.version_range} onChange={(e)=>handleChange(index, e)} aria-label="Range Select">
				{VERSION_RANGE_CHOICES.map((choice) => (
				    <option key={choice.val} value={choice.val}>{choice.desc} </option>
				))}
			    </Form.Select>
			    {invalidVersion[index].field == "version_range" &&
			     <Form.Text className="error">
				 {invalidVersion[index].msg}
			     </Form.Text>
			    }
			</Col>
			<Col lg={3} md={6} sm={12}>
			    <Form.Label>End Version Range</Form.Label>
			    <Form.Control isInvalid={invalidVersion[index].field == "version_end_range"} name="version_end_range" value={element.version_end_range}  onChange={(e)=>handleChange(index, e)}/>
			    {invalidVersion[index].field == "version_end_range" &&
			     <Form.Text className="error">
				 {invalidVersion[index].msg}
			     </Form.Text>
			    }
			</Col>
			<Col lg={2} md={6} sm={12}>
			    <Form.Label>Version Type</Form.Label>
			    <Form.Select name="version_type" value={element.version_type} isInvalid={invalidVersion[index].field == "version_type"} onChange={(e)=>handleChange(index, e)} aria-label="Version Type Select">
				{VERSION_TYPE_CHOICES.map((choice) => (
				    <option key={choice.val} value={choice.val}>{choice.desc} </option>
                    ))}
			    </Form.Select>
			    {invalidVersion[index].field == "version_type" &&
			     <Form.Text className="error">
				 {invalidVersion[index].msg}
			     </Form.Text>
			    }

			</Col>
		    </Row>

		</div>
	    ))}
	    <div className="button-section mb-2">
		<Button size="sm" variant="primary" type="button" onClick={() => addVersions()}>Add Version</Button>
	    </div>

	</>


    )
};

export default CPETypeahead;
