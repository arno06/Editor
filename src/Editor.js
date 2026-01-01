var Editor = (function(){
    let modal;
    let panel;
    let addButton;
    let addRef = null;
    let addRefPosition = null;
    let panelAbortController = null;
    let panelSearchTO = null;
    let panelDisabled = false;

    function init(){

        addButton = HTMLElement.create("div", {className:["editor-add", "editor-button"], innerHTML: "+"}, document.body);
        addButton.addEventListener('click', addBlockHandler);

        document.querySelectorAll('[data-template]').forEach(registerBlock);

        let overlay = HTMLElement.create("div", {className:["editor-overlay"]}, document.body);
        overlay.addEventListener('click', hideAllHandler, true);

        panel = HTMLElement.create("div", {className:["editor-panel"]}, document.body);
        modal = HTMLElement.create("div", {className:["editor-modal"]}, document.body);
    }

    function registerBlock(pEl){
        pEl.addEventListener('click', editHandler);
        pEl.addEventListener('mouseover', showAddBlockHandler);
        pEl.addEventListener('mouseout', hideAddBlockHandler);
    }

    function removeBlock(pEl){

        let setup = EDITOR_SETUP[pEl.getAttribute("data-template")];
        if(setup && setup.mandatory){
            return;
        }
        pEl.removeEventListener('click', editHandler);
        pEl.removeEventListener('mouseover', showAddBlockHandler);
        pEl.removeEventListener('mouseout', hideAddBlockHandler);
        pEl.remove();
    }

    function addBlockHandler(e){
        if(!addRef){
            return;
        }

        modal.innerHTML = "";
        let blockLists = HTMLElement.create("div", {className:["editor-tpl-list"]}, modal);
        for(let i in EDITOR_SETUP){
            if(!EDITOR_SETUP.hasOwnProperty(i)){
                continue;
            }

            let infos = EDITOR_SETUP[i];

            if(infos.limit){
                let existings_blocs = document.querySelectorAll('div[data-template="'+i+'"]');
                if(existings_blocs.length >= infos.limit){
                    continue;
                }
            }

            let tpl = infos.tpl;
            let label = infos.label;

            if(!tpl){
                continue;
            }

            let block = HTMLElement.create("div", {className:["editor-tpl-block"]}, blockLists);
            HTMLElement.create("div", {innerHTML:tpl}, block);
            HTMLElement.create("span", {innerHTML:label}, block);

            block.addEventListener("click", (e)=>{
                let newBlock = document.createElement('div');
                newBlock.setAttribute("data-template", i);
                newBlock.innerHTML = tpl;
                addRef.insertAdjacentElement(addRefPosition, newBlock);
                registerBlock(newBlock);
                newBlock.querySelectorAll('*[data-template]').forEach(registerBlock);
                hideAllHandler();
                editHandler({target:newBlock, currentTarget:newBlock});
            });
        }
        document.body.setAttribute("data-show", "modal");
    }

    function adjustAddBlock(e){
        let rect = addRef.getBoundingClientRect();
        let posY = rect.top;
        addRefPosition = "beforebegin";
        if(e.clientY > (rect.top + (rect.height>>1))){
            posY += rect.height;
            addRefPosition = "afterend";
        }
        addButton.style.left = (rect.left + (rect.width>>1)) + "px";
        addButton.style.top = (window.scrollY + posY) +"px";

        const THRESHOLD = 30;
        if((e.clientY >= rect.top && e.clientY < (rect.top + THRESHOLD))
            || (e.clientY < (rect.top + rect.height) && e.clientY > (rect.top + rect.height - THRESHOLD))){
            addButton.classList.add("show");
        }else{
            addButton.classList.remove("show");
        }
    }

    function showAddBlockHandler(e){
        document.addEventListener('mousemove', adjustAddBlock);
        addRef = e.currentTarget;
        adjustAddBlock(e);
        e.stopImmediatePropagation();
    }

    function hideAddBlockHandler(e){
        document.removeEventListener('mousemove', adjustAddBlock);
        addButton.classList.remove("show");
    }

    function editHandler(e){
        if(panelDisabled === true){
            return;
        }
        let target = e.currentTarget;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        let type = target.getAttribute("data-template");

        if(!EDITOR_SETUP.hasOwnProperty(type) || !EDITOR_SETUP[type].fields){
            return;
        }

        let setup = EDITOR_SETUP[type];

        target.parentNode.querySelectorAll(".editor-selected").forEach((pEl)=>{
            pEl.classList.remove("editor-selected");
        });
        target.classList.add("editor-selected");

        panel.innerHTML = "";

        if(setup && !setup.mandatory){
            let actions = HTMLElement.create("div", {className:["editor-actions"]}, panel);
            let removeButton = HTMLElement.create("button", {innerHTML:"Supprimer", className:["editor-button", "editor-remove"]}, actions);
            removeButton.addEventListener('click', (e)=>{
                removeBlock(target);
                hideAllHandler();
            });
        }

        let hasUpload = false;

        for(let i = 0, max = setup.fields.length; i<max; i++){
            let f = setup.fields[i];
            let modifiers = f.modifiers||{};
            let conditionalDisplay = f.conditionalDisplay||false;
            let isCheckBox = f.tag === "input" && f.attributes && f.attributes.type === "checkbox";
            let extra_attributes = {autocomplete:"off"};
            if(f.targets){
                let val = target.querySelector(f.targets[0].selector);
                if(!isCheckBox){
                    if(!val){
                        extra_attributes.value = "";
                    }else{
                        switch(f.targets[0].attribute){
                            case "innerHTML":
                                extra_attributes.value = val[f.targets[0].attribute];
                                break;
                            default:
                                extra_attributes.value = val.getAttribute(f.targets[0].attribute);
                                break;
                        }
                    }
                }else{
                    if(val &&  val.getAttribute(f.targets[0].attribute)===f.attributes.value){
                        extra_attributes.checked = true;
                    }
                }
            }

            if(extra_attributes.value && modifiers){
                for(let i in modifiers){
                    if(!modifiers.hasOwnProperty(i)){
                        continue;
                    }
                    let regexp = i;
                    let replace = modifiers[i];
                    if(replace.indexOf("[capture]")>-1){
                        let re = new RegExp("\\([^\)]+\\)");
                        let res = re.exec(regexp);
                        let reg = res[0];
                        regexp = regexp.replace(re, "$1").replaceAll('\\', "");
                        replace = replace.replace("[capture]", reg);
                    }
                    extra_attributes.value = extra_attributes.value.replaceAll(new RegExp(replace, "g"), regexp);
                }
            }

            let id = "editor_input_"+i;
            extra_attributes.id = id;
            let extra_classes = f["class"]||[];
            let comp = HTMLElement.create("div", {className:["editor-component", ...extra_classes]}, panel);
            if(f.label){
                let label = f.label;
                if(f.tooltip){
                    label += '<i title="'+f.tooltip+'">i</i>';
                }
                HTMLElement.create("label", {innerHTML:label, for:id}, comp);
            }
            let container_classes = [];
            if(f.attributes && f.attributes.type === "file"){
                hasUpload = true;
                delete extra_attributes.value;
                container_classes.push("upload");
            }
            let parentInput = HTMLElement.create("div", {className:["input", ...container_classes]}, comp);
            let input = HTMLElement.create(f.tag, {...f.attributes, ...extra_attributes}, parentInput);

            if(f.hydrateFields){
                let infoHydrate = f.hydrateFields;
                let to = null;
                input.addEventListener('input', (e)=>{
                    if(to){
                        window.clearTimeout(to);
                    }

                    let val = e.currentTarget.value;

                    if(!val.length){
                        return;
                    }

                    let inp = e.currentTarget;
                    inp.classList.add("loading");
                    to = window.setTimeout(()=>{
                        fetch(infoHydrate.url+encodeURIComponent(val))
                            .then((data)=>data.json())
                            .then((pJson)=>{
                                for(let prop in infoHydrate.mapping){
                                    if(!infoHydrate.mapping.hasOwnProperty(prop) || !pJson.hasOwnProperty(prop)){
                                        continue;
                                    }
                                    let m = infoHydrate.mapping[prop];
                                    let mapEl = document.querySelector(m.selector);
                                    switch(m.attribute){
                                        case "value":
                                        case "innerHTML":
                                            mapEl[m.attribute] = pJson[prop].stripTags();
                                            break;
                                        default:
                                            mapEl.setAttribute(m.attribute, pJson[prop].stripTags());
                                            break;
                                    }
                                    mapEl.dispatchEvent(new Event("change"));
                                    mapEl.dispatchEvent(new Event("input"));
                                }
                            })
                            .finally(()=>{
                                inp.classList.remove("loading");
                            });
                    }, 200);
                });
            }

            if(!f.targets||!f.targets.length){
                continue;
            }
            if(conditionalDisplay && !document.querySelectorAll(f.targets[0].selector).length){
                comp.style.display = "none";
                continue;
            }
            input.addEventListener('input', (e)=>{
                let value = e.currentTarget.value;
                if(isCheckBox){
                    value = e.currentTarget.checked?value:"";
                }
                if(modifiers){
                    for(let i in modifiers){
                        if(!modifiers.hasOwnProperty(i)){
                            continue;
                        }
                        let re = new RegExp(i, 'g');
                        value = value.replaceAll(re, modifiers[i].replace(/\[capture]/, '\$1'));
                    }
                }
                if(e.currentTarget.nodeName.toLowerCase() === "textarea"){
                    value = value.replace(/\n/g, "<br/>");
                }
                f.targets.forEach((t)=>{
                    target.querySelectorAll(t.selector).forEach((pEl)=>{
                        switch(t.attribute){
                            case "innerHTML":
                                pEl[t.attribute] = value;
                                break;
                            default:
                                pEl.setAttribute(t.attribute, value);
                                break;
                        }
                    });
                });
            });
        }

        if(hasUpload){
            UploaderJS.init();

            for(let i = 0, max = setup.fields.length; i<max; i++) {
                let f = setup.fields[i];
                if(!f.attributes || f.attributes.type !== "file"){
                    continue;
                }

                let id = "editor_input_"+i;
                document.querySelector("#"+id).parentNode.querySelector("a.file").addEventListener("change", (e)=>{
                    let value = e.currentTarget.getAttribute("href");
                    f.targets.forEach((t)=>{
                        target.querySelectorAll(t.selector).forEach((pEl)=>{
                            switch(t.attribute){
                                case "innerHTML":
                                    pEl[t.attribute] = value;
                                    break;
                                default:
                                    pEl.setAttribute(t.attribute, value);
                                    break;
                            }
                        });
                    });
                });
            }
        }

        if(setup.id && setup.sources){

            let container = HTMLElement.create("div", {className:["editor-component", "list"]}, panel);

            let filters = setup.fields.reduce((pPrev, pField)=>{
                if(pField.attributes && pField.attributes.name && pField.search === true){
                    pPrev.push(pField.attributes.name);
                }
                return pPrev;
            }, []);
            filters.forEach((pName)=>{
                document.querySelector('[name="'+pName+'"]').addEventListener("input", (e)=>{
                    if(panelSearchTO){
                        panelAbortController.abort("stop");
                        clearTimeout(panelSearchTO);
                    }
                    container.classList.add("loading");
                    panelSearchTO = setTimeout(updateList, 300);
                });
            });

            const updateList = ()=>{
                container.classList.add("loading");
                let url = setup.sources.search;
                filters.forEach((pName)=>{
                    let el = document.querySelector('[name="'+pName+'"]');
                    if(!el || !el.value){
                        return;
                    }
                    url += '&'+pName+"="+encodeURIComponent(el.value);
                });
                if(panelAbortController){
                    panelAbortController.abort("stop");
                }
                panelAbortController = new AbortController();
                let existingsIds = Array.from(document.querySelectorAll('div[data-template="'+type+'"]')).map((pEl)=>{return pEl.getAttribute("data-id");});
                const signal = panelAbortController.signal;
                fetch(url, {signal})
                    .then((pResponse)=>pResponse.json())
                    .then((pJSON)=>{
                        container.classList.remove("loading");

                        let html = "";
                        if(pJSON.results){
                            html = pJSON.results.reduce((pPrevious, pResult)=>{
                                let cls = existingsIds.indexOf(pResult.id)>-1?" disabled":"";
                                let img = "";
                                if(pResult.img){
                                    img = "<div class='img'><img src='"+pResult.img+"'/></div>";
                                }
                                pPrevious += `
                                    <div class="item${cls}" data-id="${pResult.id}">
                                        <div class="infos">
                                            <div class="details">${pResult.details}</div>
                                            <div class="title">${pResult.title}</div>
                                        </div>
                                        ${img}
                                    </div>`;
                                return pPrevious;
                            }, "<div class='list_item'>")+"</div>";
                        }
                        container.innerHTML = html;

                        container.querySelectorAll("div[data-id]").forEach((pEl)=>{
                            pEl.addEventListener("click", (e)=>{
                                let id = e.currentTarget.getAttribute("data-id");
                                fetch(setup.sources.entry+id).then((pResponse)=>pResponse.json())
                                    .then((pJSON)=>{
                                        target.setAttribute("data-id", id);
                                        let oldHeight = target.offsetHeight;
                                        target.style.height = oldHeight+"px";
                                        target.style.overflow = "hidden";
                                        target.innerHTML = pJSON.html;
                                        target.style.height = "auto";
                                        let newSize = target.offsetHeight;
                                        target.style.height = oldHeight+"px";
                                        M4Tween.killTweensOf(target);
                                        M4Tween.to(target, .3, {height:newSize+"px"}).onComplete(()=>{
                                            target.removeAttribute("style");
                                        });
                                        registerBlock(target);
                                        Editor.hidePanels();
                                    });
                            });
                        });
                    });
            };

            updateList();
        }

        document.body.setAttribute("data-show", "panel");

        if(setup.editHandler){
            setup.editHandler(target);
        }
    }

    function hideAllHandler(e){
        document.querySelector('.editor-selected')?.classList.remove("editor-selected");
        document.body.removeAttribute("data-show");
    }

    function prepareForm(){
        let done = [];
        let extractTemplates = (pPrevious, pEl)=>{
            if(done.indexOf(pEl)>-1){
                return pPrevious;
            }
            const tpl = pEl.getAttribute("data-template");

            //Array.from().map...
            let children = Array.from(pEl.querySelectorAll("[data-template]")).reduce(extractTemplates, []);
            done.push(pEl);
            let block = {
                order_block:pPrevious.length,
                type_block:tpl,
                data_block:{},
                children:children
            };
            let data = {};
            const infos = EDITOR_SETUP[tpl];
            if(!infos){
                pPrevious.push(block);
                return pPrevious;
            }
            if(pEl.getAttribute("data-id") && infos.id){
                data[infos.id] = pEl.getAttribute("data-id");
            }
            if(!infos.fields || !infos.fields.length){
                if(data){
                    pPrevious.push({
                        ...block,
                        data_block:data
                    });
                }
                return pPrevious;
            }
            for(let j = 0, max = infos.fields.length; j<max; j++){
                const f = infos.fields[j];
                if(!f.attributes || !f.attributes.name || !f.targets || !f.targets.length){
                    continue;
                }
                const t = pEl.querySelector(f.targets[0].selector);
                if(!t){
                    continue;
                }
                let value;
                switch(f.targets[0].attribute){
                    case "innerHTML":
                        value = t.innerHTML;
                        break;
                    default:
                        value = t.getAttribute(f.targets[0].attribute);
                        break;
                }
                data[f.attributes.name] = value;
            }
            console.log(data);
            pPrevious.push({
                ...block,
                data_block:data
            });
            return pPrevious;
        };
        return Array.from(document.querySelectorAll("[data-template]")).reduce(extractTemplates, []);
    }

    HTMLElement.create = function(pTag, pProps, pParentNode = null){
        let el = document.createElement(pTag);

        for(let i in pProps){
            if(!pProps.hasOwnProperty(i)){
                continue;
            }
            switch(i){
                case "options":
                    if (pTag === "select"){
                        pProps[i].forEach((pOpt)=>{
                            el.appendChild(new Option(pOpt.label, pOpt.value));
                        });
                    }
                    break;
                case "className":
                    el.classList.add(...pProps[i]);
                    break;
                case "value":
                    if(pTag === "textarea"){
                        el.innerHTML = pProps[i];
                    }else{
                        el.value = pProps[i];
                    }
                    break;
                case "innerHTML":
                    el.innerHTML = pProps[i];
                    break;
                default:
                    el.setAttribute(i, pProps[i]);
                    break;
            }
        }

        if(pParentNode){
            pParentNode.appendChild(el);
        }

        return el;
    }

    window.addEventListener('DOMContentLoaded', init);

    return {
        disabledPanel:()=>{
            panelDisabled = true;
        },
        hidePanels:hideAllHandler,
        prepareForm:prepareForm,
        showModal:(pChild)=>{
            modal.innerHTML = "";
            modal.appendChild(pChild);
            document.body.setAttribute("data-show", "modal");
        }
    };
})();