var http= require('http');
var path=require('path');
var url=require('url');
var querystring=require('querystring');
var fs=require('fs');
var formidable=require('formidable');
var mime=require('mime');
var cookieParser = require('./cookieParser');
var currentUser={}; //当前用
var EXPIRE_TIME=5*1000;
var key='boke';



var server =http.createServer();

server.on('connection',function(){
    console.log('连接');
});


server.on('request',function(req,res){
    var now=Date.now(); //随机数
    var objectUrl=url.parse(req.url,true);
    var pathName=objectUrl.pathname;
    var queryPar=objectUrl.query;
    console.log(pathName);
    var cookieObj = querystring.parse(req.headers.cookie,'; ');
    var sessionId = cookieObj[key];
    var sessionObj = currentUser[sessionId];

    if(pathName=='/' || pathName=='/login.html'){
        res.setHeader('Content-Type',mime.lookup('login.html'));
        var htmltem='<ul class="nav navbar-nav navbar-right">';
        htmltem+='<button type="button" class="btn btn-default navbar-btn" onclick="{window.location.href=\'login.html\'}">登录</button>'
        htmltem+='<button type="button" class="btn btn-primary navbar-btn" onclick="{window.location.href=\'reg.html\'}">注册</button>'
        htmltem+='</ul>'
        var htmlstr=fs.readFileSync('./login.html','utf8');
        htmlstr=htmlstr.replace("@login",htmltem);

        htmltem='<li class="active" ><a  href=\'list.html\'>文章列表</a></li>';
        htmlstr= htmlstr.replace("@navContent",htmltem);
        htmlstr= htmlstr.replace("@userMessage","");
        res.end(htmlstr);
    }
    else if(pathName=='/ajax')
    {
        //req.pipe(fs.createWriteStream('./from.txt'));
        //注册
        var submitform=formidable.IncomingForm();
        if(queryPar.action=='reg')  //根据action参数判断具体操作
        {
            //将报文体进行格式化 fields上传的字段和对应的值     files表示上传的文件
            submitform.parse(req, function (err, fields, files) {
                //头像保存路径s
                var avatarFileSrc='./upload/'+files.avatar.name;
                //得到上传文件的路径将其保存到头像文件夹
                fs.createReadStream(files.avatar.path).pipe(fs.createWriteStream(avatarFileSrc));
                //将注册的用户保存到txt文本中
                var userMessage=';user='+fields.loginName+"&pwd="+fields.loginPwd+"&avatar="+files.avatar.name;
                fs.appendFileSync('./userList.txt',userMessage,'utf-8');
                //用户注册成功后跳转到登录页面
                res.statusCode=302;  //
                res.setHeader("Location","login.html")
                res.end();
            });
        }
        //登录判断的方法
        else if(queryPar.action=='login')
        {
            var userTemStr=fs.readFileSync('./userList.txt','utf-8'); //读取所有用户

            if(userTemStr!='') {
                //把用户信息按;号分格 并去掉第一个空用户
                //;
                // user=wwww&pwd=2222&avatar=secondarytile.png
                // ;
                // user=qweqwe&pwd=2222&avatar=secondarytile.pn
                var usersStr=userTemStr.split(';').slice(1);
                //循环所有用户。。看看有没有和前台输入一直的用户名和密码  如果有登录成功。。
                usersStr.forEach(function (item) {
                    item=querystring.parse(item);
                    //console.log('item.user='+item.user+" loginName "+queryPar.loginName+"  tem.pwd"+item.pwd+"  loginPwd"+queryPar.loginPwd)
                    if(item.user==queryPar.loginName && item.pwd==queryPar.loginPwd)
                    {
                        item.expTime=new Date(new  Date().getTime()+EXPIRE_TIME);
                        var sessionObj=item;
                        var sessionId=now+'_'+Math.random();
                        currentUser[sessionId]=sessionObj;
                        res.writeHead(200,{"Set-Cookie":cookieParser.serialize(key,sessionId,{maxAge:30*60})});
                        res.end('ok');
                    }
                    else{
                        res.end('no');
                    }
                });
            }
            else{
                res.statusCode=404;
                res.end('用户不存在！');
            }

        }
        else
        {

        }
    }
    else if(pathName=='/favicon.ico')
    {
        res.statusCode=404;
        res.end(http.STATUS_CODES[404]);
    }
    else{
        if(fs.existsSync('.'+pathName))
        {
            res.setHeader('Content-Type',mime.lookup(pathName));
            var htmlstr="";
            //不是html文件直接读取并返回给客户端
            if(path.extname(pathName)!='.html')
            {
                return res.end( fs.readFileSync('.'+pathName));
            }
            //如果是html文件要进行拼装把内容替换一下
            if(sessionObj && sessionObj.expTime && sessionObj.expTime.getTime()>now )
            {

                var htmltem='<ul class="nav navbar-nav navbar-right">';
                htmltem+= '<li class="dropdown">';
                htmltem+='<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">';
                htmltem+='<img src="/images/user.png" style=" width: 20px; height: 20px; " />';
                htmltem+='<span class="caret"></span></a>';
                htmltem+='<ul class="dropdown-menu">';
                htmltem+='<li><a href="#">安全退出</a></li></ul></li></ul>';

                var htmlstr=fs.readFileSync('.'+pathName,'utf8').replace("@userMessage",htmltem);
                htmltem='<li class="active" ><a  href=\'list.html\'>文章列表</a></li>';
                htmltem+='<li ><a href=\'addArticle.html\'>文章发布</a></li>';
                htmlstr= htmlstr.replace("@navContent",htmltem);
                htmlstr=htmlstr.replace("@login","");

                if(sessionObj){
                    console.log("sessionObj"+sessionObj.expTime);

                    sessionObj.expTime=new Date(new Date().getTime()+EXPIRE_TIME);
                    console.log("sessionObj"+sessionObj.expTime);
                }

            }
            else
            {

                if(pathName=='/addArticle.html'){
                    console.log( 'pathName'+ pathName);
                    res.statusCode=302;
                    res.setHeader("Location","login.html");
                    res.end();
                }
                else
                {
                    console.log( 'pathName2'+ pathName);

                    res.setHeader('Content-Type',mime.lookup('login.html'));
                    var htmltem='<ul class="nav navbar-nav navbar-right">';
                    htmltem+='<button type="button" class="btn btn-default navbar-btn" onclick="{window.location.href=\'login.html\'}">登录</button>'
                    htmltem+='<button type="button" class="btn btn-primary navbar-btn" onclick="{window.location.href=\'reg.html\'}">注册</button>'
                    htmltem+='</ul>'
                    htmlstr=fs.readFileSync('./'+pathName,'utf8');
                    htmlstr=htmlstr.replace("@login",htmltem);

                    htmltem='<li class="active" ><a  href=\'list.html\'>文章列表</a></li>';
                    htmlstr= htmlstr.replace("@navContent",htmltem);
                    htmlstr= htmlstr.replace("@userMessage","");

                }

            }

            res.end(htmlstr);
            //fs.createReadStream('.'+pathName).pipe(res);
        }
        else
        {
            res.status=404;
            res.end(http.STATUS_CODES[404]);
        }
    }
});

server.listen(8080)

