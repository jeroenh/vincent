import React from 'react';
import { useCallback, useState, useEffect } from 'react';
import AdminAPI from './AdminAPI.js';
import {Typeahead, AsyncTypeahead} from 'react-bootstrap-typeahead';
import DisplayLogo from "./DisplayLogo";
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import '../css/casethread.css'

const adminapi = new AdminAPI();

const CACHE = {};
const PER_PAGE = 50;

const TAG_CATEGORIES = [
    {val: 1, desc: 'vulnerability'},
    {val: 2, desc: 'case'},
    {val: 3, desc: 'group'},
    {val: 4, desc: 'component'},
]

function makeAndHandleRequest(category, query, page = 1) {
    let urlstr = `?category=${category}`
    if (query) {
        urlstr = `${urlstr}&search=${query}`;
    }
    return adminapi.getTags(urlstr).then((response) => {
        let items = response;
	const options = items.map((i) => ({'tag': i.tag, 'id': i.id}));
	let totalcount = options.length
        return {options, totalcount};
    });
}

const TagTypeahead = (props) => {

    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [query, setQuery] = useState("");
    const [options, setOptions] = useState([]);
    const [initialLoad, setInitialLoad] = useState(true);
    const [category, setCategory] = useState(2);
    
    const handleInputChange = (q) => {
	setQuery(q);
    };

    const handleSearch = useCallback((q) => {
        if (CACHE[q]) {
            setOptions(CACHE[q].options);
            return;
        }

        setIsLoading(true);
        makeAndHandleRequest(category, q).then((resp) => {
            CACHE[q] = { ...resp, page: 1 };
            console.log("OPTIONS ARE>>>>>>>", resp.options);
            setIsLoading(false);
            setOptions(resp.options);
        });
    }, []);


    const fetchInitialData = async () => {
	let cat = TAG_CATEGORIES[1]; 
	if (props.dataType) {
	    cat = TAG_CATEGORIES.find(x => x.desc === props.dataType);
	}
	setCategory(cat.val);
        await makeAndHandleRequest(cat.val, query).then((resp) => {
            CACHE[query] = { ...resp, page: 1 };
            setIsLoading(false);
            setOptions(resp.options);
	    setInitialLoad(false);
	    console.log(resp.options);
        });

    }


    useEffect(() => {
	if (props.options) {
	    setOptions(props.options);
	    setInitialLoad(false);
	} else {
	    fetchInitialData();
	}
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

        makeAndHandleRequest(category, query, page).then((resp) => {
            const options = cachedQuery.options.concat(resp.options);
            CACHE[query] = { ...cachedQuery, options, page };

            setIsLoading(false);
            console.log("OPTIONS ARE, options");
            setOptions(options);
        });
    };

    return (
	<>
	    {initialLoad ?
	     <div className="text-center">                     
                 <div className="lds-spinner">                 
                     <div></div>                               
                     <div></div>                               
                     <div></div>                               
                 </div>                                        
             </div>  
	     :
	     <>
		 {options.length > 0 ?
		  <Typeahead
		      inputProps={{
			  'aria-label': props.label,
		      }}
		      id="vinceTags"
		      multiple={true}
		      options={options}
		      labelKey="tag"
		      placeholder="Search tags"
		      onChange={props.setTags}
		      disabled = {props.disabled}
		      selected={props.tags}
		      className="typeahead"
		  />		  
		  :
	     
		  <AsyncTypeahead
		      id="vinceTags"
		      multiple={true}
		      options = {options}
		      isLoading={isLoading}
		      onPaginate={handlePagination}
		      onSearch={handleSearch}
		      paginate
		      inputProps={{
			  'aria-label': props.label,
		      }}
		      allowNew={false}
		      disabled={props.disabled}
		      onChange={props.setTags}
		      selected={props.tags}
		      onInputChange={handleInputChange}
		      labelKey="tag"
		      isInvalid={props.invalid}
		      placeholder="Search tags"
		      renderMenuItemChildren={(option) => (
			  <span className="tag">{option.tag}</span>
		      )}
		      useCache={false}
		  />
		 }
	     </>
	    }
	</>
    )

};

export default TagTypeahead;
