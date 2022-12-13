import React from 'react';
import { useCallback, useState, useEffect } from 'react';
import ContactAPI from './ContactAPI.js';
import {Typeahead, AsyncTypeahead} from 'react-bootstrap-typeahead';
import DisplayLogo from "./DisplayLogo";
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import '../css/casethread.css'

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
        let total_count = items.length;
        const options = items.map((i) => ({
            name: i.name,
            uuid: i.uuid,
            color: i.logocolor,
            logo: i.photo
        }));
        console.log(options);
        return {options, total_count};
    });
}

const GroupTypeahead = (props) => {

    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [query, setQuery] = useState("");
    const [options, setOptions] = useState([]);

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

    return (
	props.options ?
	    <Typeahead
		id="owner"
		options={props.options}
		labelKey="name"
		inputProps={{"aria-label": 'Select a Group',}}
		placeholder="Select a group"
		onChange={props.setOwner}
		disabled = {props.disabled}
		selected={props.owner}
		className="typeahead"
	    />
	:
	
        <AsyncTypeahead
            id="owner"
            options = {options}
            isLoading={isLoading}
            onPaginate={handlePagination}
            onSearch={handleSearch}
            paginate
	    disabled={props.disabled}
	    inputProps={{"aria-label": 'Select a Group',}}
            onChange={props.setOwner}
	    selected={props.owner}
            onInputChange={handleInputChange}
            labelKey="name"
	    isInvalid={props.invalid}
            placeholder="Search for a group"
            renderMenuItemChildren={(option) => (
                <div className="d-flex align-items-center gap-2">
                    <DisplayLogo
                        name={option.name}
                        photo={option.photo}
                        color={option.color}
                    />
                    <span className="participant">{option.name}</span>
                </div>
		
            )}
            useCache={false}
        />
    )

};

export default GroupTypeahead;
