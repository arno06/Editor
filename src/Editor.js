var Editor = (function(){
    let container = null;

    /**
     * @type {Object.<string, EditorTemplate>}
     */
    let editor_setup = {};

    let modal;
    let panel;
    let addButton;
    let addRef = null;
    let addRefPosition = null;
    let panelAbortController = null;
    let panelSearchTO = null;
    let panelDisabled = false;

    function init(pSelectorContainer, pSetup){

        addButton = HTMLElement.create("div", {className:["editor-add", "editor-button"], innerHTML: "+", click:addBlockHandler}, document.body);

        container = document.querySelector(pSelectorContainer)||document;
        container.querySelectorAll('[data-template]').forEach(EditorBlock.register);

        let overlay = HTMLElement.create("div", {className:["editor-overlay"]}, document.body);
        overlay.addEventListener('click', hideAllHandler, true);

        panel = HTMLElement.create("div", {className:["editor-panel"]}, document.body);
        modal = HTMLElement.create("div", {className:["editor-modal"]}, document.body);
        editor_setup = {};
        for(let i in pSetup){
            if(!pSetup.hasOwnProperty(i)){
                continue;
            }
            editor_setup[i] = EditorTemplate.from(pSetup[i]);
        }
    }

    function addBlockHandler(e){
        if(!addRef){
            return;
        }

        modal.innerHTML = "";
        let blockLists = HTMLElement.create("div", {className:["editor-tpl-list"]}, modal);
        for(let i in editor_setup){
            if(!editor_setup.hasOwnProperty(i)){
                continue;
            }

            let infos = editor_setup[i];

            if(infos.limit){
                let existing_blocs = container.querySelectorAll('div[data-template="'+i+'"]');
                if(existing_blocs.length >= infos.limit){
                    continue;
                }
            }

            let tpl = infos.tpl;
            let label = infos.label;

            if(!tpl){
                continue;
            }

            let block = HTMLElement.create("div", {className:["editor-tpl-block"], "data-template":i, click:EditorBlock.addFromTemplateHandler}, blockLists);
            HTMLElement.create("div", {innerHTML:tpl}, block);
            HTMLElement.create("span", {innerHTML:label}, block);
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
        let target = e.currentTarget;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        let type = target.getAttribute("data-template");

        e.stopImmediatePropagation && e.stopImmediatePropagation();

        let setup = editor_setup[type];

        target.parentNode.querySelectorAll(".editor-selected").forEach((pEl)=>{
            pEl.classList.remove("editor-selected");
        });

        panel.innerHTML = "";
        let emptyPanel = true;

        if(setup && !setup.mandatory){
            emptyPanel = false;
            let actions = HTMLElement.create("div", {className:["editor-actions"]}, panel);
            let removeButton = HTMLElement.create("button", {
                innerHTML:"Supprimer",
                className:["editor-button", "editor-remove"],
                click:(e)=>{
                    EditorBlock.remove(target);
                    hideAllHandler();
                }}, actions);
            if(target.parentNode.querySelectorAll('[data-template]').length === 1){
                removeButton.setAttribute("disabled", "disabled");
            }
        }

        if(panelDisabled || (!editor_setup.hasOwnProperty(type) || !setup.fields)){
            if(!emptyPanel){
                target.classList.add("editor-selected");
                document.body.setAttribute("data-show", "panel");
            }
            if(setup.editHandler){
                setup.editHandler(target);
            }
            return;
        }

        target.classList.add("editor-selected");

        let hasUpload = false;
        emptyPanel = emptyPanel && setup.fields.length===0;
        for(let i = 0, max = setup.fields.length; i<max; i++){
            let f = setup.fields[i];
            f.attachContext(target);
            let modifiers = f.modifiers||{};
            let conditionalDisplay = f.conditionalDisplay||false;
            let isCheckBox = f.isCheckBox();
            let extra_attributes = f.getAttributes();

            let id = "editor_input_"+i;
            extra_attributes.id = id;
            let extra_classes = f["class"]||[];
            let comp = HTMLElement.create("div", {className:["editor-component", ...extra_classes]}, panel);
            if(f.label){
                HTMLElement.create("label", {innerHTML:f.getLabel(), for:id}, comp);
            }
            let container_classes = [];
            if(f.isUpload()){
                hasUpload = true;
                container_classes.push("upload");
            }
            let parentInput = HTMLElement.create("div", {className:["input", ...container_classes]}, comp);
            let input = HTMLElement.create(f.tag, extra_attributes, parentInput);

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
                                    let mapEl = container.querySelector(m.selector);
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
            if(conditionalDisplay && !target.querySelectorAll(f.targets[0].selector).length){
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
                f.updateTargets(value);
            });
        }

        if(hasUpload && UploaderJS){
            UploaderJS.init();

            for(let i = 0, max = setup.fields.length; i<max; i++) {
                let f = setup.fields[i];
                if(!f.attributes || f.attributes.type !== "file"){
                    continue;
                }

                let id = "editor_input_"+i;
                document.querySelector("#"+id).parentNode.querySelector("a.file").addEventListener("change", (e)=>{
                    let value = e.currentTarget.getAttribute("href");
                    f.updateTargets(value);
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
                        if(pJSON.results && pJSON.results.length){
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
                        }else{
                            html = "<div class='empty'>Aucun résultat ne correspond à votre recherche</div>";
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
                                        EditorBlock.register(target);
                                        Editor.hidePanels();
                                    });
                            });
                        });
                    });
            };

            updateList();
        }

        if(!emptyPanel){
            document.body.setAttribute("data-show", "panel");
        }

        if(setup.editHandler){
            setup.editHandler(target);
        }
    }

    function hideAllHandler(e){
        container.querySelector('.editor-selected')?.classList.remove("editor-selected");
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
            const infos = editor_setup[tpl];
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
            pPrevious.push({
                ...block,
                data_block:data
            });
            return pPrevious;
        };
        return Array.from(container.querySelectorAll("[data-template]")).reduce(extractTemplates, []);
    }

    class EditorBlock
    {

        static addFromTemplateHandler(e){

            let templateName = e.currentTarget.getAttribute("data-template");
            if(!editor_setup[templateName]){
                return;
            }
            let template = editor_setup[templateName];
            let newBlock = HTMLElement.create("div", {"data-template":templateName, innerHTML:template.tpl})
            addRef.insertAdjacentElement(addRefPosition, newBlock);
            EditorBlock.register(newBlock);
            newBlock.querySelectorAll('*[data-template]').forEach(EditorBlock.register);
            hideAllHandler();
            let panelD = panelDisabled;
            panelDisabled = false;
            editHandler({target:newBlock, currentTarget:newBlock});
            panelDisabled = panelD;
        }

        static register(pEl){
            pEl.addEventListener('click', editHandler);
            pEl.addEventListener('mouseover', showAddBlockHandler);
            pEl.addEventListener('mouseout', hideAddBlockHandler);
        }

        static remove(pEl){
            let setup = editor_setup[pEl.getAttribute("data-template")];
            if(setup && setup.mandatory){
                return;
            }
            pEl.removeEventListener('click', editHandler);
            pEl.removeEventListener('mouseover', showAddBlockHandler);
            pEl.removeEventListener('mouseout', hideAddBlockHandler);
            pEl.remove();
        }
    }

    class EditorTemplate {
        label = "";
        /**
         * @type {null|number}
         */
        limit = null;
        mandatory = false;
        id = null;

        /**
         *
         * @type {Array.<EditorFields>}
         */
        fields = [];
        editHandler = ()=>{};
        tpl = "";
        sources = null;

        /**
         * @param {Object} pJson
         * @returns {EditorTemplate}
         */
        static from(pJson){
            let ins = Object.assign(new EditorTemplate(), pJson);
            let fields = [];
            for(let i in ins.fields){
                fields.push(Object.assign(new EditorFields(), ins.fields[i]));
            }
            ins.fields = fields;
            return ins;
        }
    }

    class EditorFields{
        attributes = {};
        class = [];
        conditionalDisplay = false;
        label = "";
        modifiers = {};
        search = false;
        tag = "";
        targets = [];
        tooltip = null;

        #context = null;

        attachContext(pContext){
            this.#context = pContext;
        }

        isCheckBox(){
            return this.tag === "input" && (this.attributes && this.attributes.type === "checkbox");
        }

        isUpload(){
            return this.attributes && this.attributes.type === "file";
        }

        getLabel(){
            let label = this.label;
            if(this.tooltip){
                label += '<i title="'+this.tooltip+'">i</i>';
            }
            return label;
        }

        getAttributes(){
            let extra_attributes = {autocomplete:"off"};
            if(this.targets.length){
                let val = this.#context.querySelector(this.targets[0].selector);
                if(!this.isCheckBox()){
                    if(!val){
                        extra_attributes.value = "";
                    }else{
                        switch(this.targets[0].attribute){
                            case "innerHTML":
                                extra_attributes.value = val[this.targets[0].attribute];
                                break;
                            default:
                                extra_attributes.value = val.getAttribute(this.targets[0].attribute);
                                break;
                        }
                    }
                }else{
                    if(val &&  val.getAttribute(this.targets[0].attribute)===this.attributes.value){
                        extra_attributes.checked = true;
                    }
                }
            }

            if(extra_attributes.value && this.modifiers){
                for(let i in this.modifiers){
                    if(!this.modifiers.hasOwnProperty(i)){
                        continue;
                    }
                    let regexp = i;
                    let replace = this.modifiers[i];
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

            if(this.isUpload()){
                delete extra_attributes.value;
            }
            return {...this.attributes, ...extra_attributes};
        }

        updateTargets(pValue){
            this.targets.forEach((t)=>{
                this.#context.querySelectorAll(t.selector).forEach((pEl)=>{
                    switch(t.attribute){
                        case "innerHTML":
                            pEl[t.attribute] = pValue;
                            break;
                        default:
                            pEl.setAttribute(t.attribute, pValue);
                            break;
                    }
                });
            });
        }
    }

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
        },
        init:init
    };
})();

HTMLElement.create = function(pTag, pProps, pParentNode = null){
    let el = document.createElement(pTag);

    for(let i in pProps){
        if(!pProps.hasOwnProperty(i)){
            continue;
        }
        switch(i){
            case "click":
                el.addEventListener(i, pProps[i]);
                break;
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