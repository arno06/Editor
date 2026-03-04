<?php
if(!isset($news)){
    $news = [
        "title_news"=>"Titre de l'actualité",
        "content_news"=>"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin semper, magna ullamcorper rutrum vehicula, ante metus blandit odio, quis dapibus risus elit vitae ex. Nulla facilisi. Maecenas elementum aliquam nunc, tempor vestibulum felis rutrum non. Nunc ac egestas dui. Praesent sed augue in dolor sollicitudin malesuada."
    ];
}

$html = <<<HTML
<div class="news" style="display:flex;gap:1em;align-items: start;">
    <div>
    <img src="{$news['img']}" width="160" style="width:160px;"/>
</div>
    <div>
    <h3>{$news['title']}</h3>
    <div style="font-size:11px;color:#999;">{$news['details']}</div>
</div>
</div>
HTML;
